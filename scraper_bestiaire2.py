"""Scraper Bestiaire Notion v2 : sans sleeps, mode visible, capture reseau.
- Pas de wait_for_timeout / sleep arbitraire : uniquement des attentes evenementielles.
- headless=False (mode visible) : le lazy-load Notion ne se declenche bien qu'en fenetre reelle.
- Multitab : 1 navigateur, N pages concurrentes (semaphore), capture des reponses images.
- Images recuperees via les reponses reseau (body exact du navigateur) : pas de 2e fetch, pas de 403, pas de moitie chargee.
"""
import asyncio
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.parse import unquote

from playwright.async_api import async_playwright

BASE = "https://silver-pen-32f.notion.site"
INDEX_URL = f"{BASE}/Bestiaire-2edd3d06b0988074a972ce20c150046d"
OUT_DIR = Path("bestiaire")
OUT_DIR.mkdir(exist_ok=True)

CONCURRENCY = 3
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 0  # 0 = tout, sinon N premiers pour test


def slugify(text: str) -> str:
    t = text.lower().strip()
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9]+", "-", t)
    return t.strip("-") or "sans-nom"


def attachment_id(proxy_url: str) -> str:
    m = re.search(r"attachment%3A([0-9a-f\-]+)", proxy_url, re.I)
    if m:
        return m.group(1).lower()
    m2 = re.search(r"attachment:([^:]+):", unquote(proxy_url))
    if m2:
        return m2.group(1).lower()
    return ""


async def dismiss_cookies(page):
    try:
        btn = page.get_by_role("button", name="Tout refuser")
        await btn.first.click(timeout=4000)
        await page.get_by_text("Politique en matière de cookies").wait_for(state="hidden", timeout=8000)
    except Exception:
        pass


async def collect_index(browser):
    ctx = await browser.new_context(locale="fr-FR", viewport={"width": 1500, "height": 900})
    page = await ctx.new_page()
    await page.goto(INDEX_URL, wait_until="domcontentloaded", timeout=60000)
    await page.wait_for_selector("main h2", timeout=30000)
    await dismiss_cookies(page)
    items = await page.evaluate(
        """() => {
          const main = document.querySelector('main');
          const nodes = Array.from(main.querySelectorAll('h2, a'));
          let cur = '';
          const out = [];
          for (const n of nodes) {
            if (n.tagName.startsWith('H')) cur = n.innerText.trim();
            else {
              const t = (n.innerText || '').trim();
              const h = n.href;
              if (h.includes('notion.site') && t && !h.endsWith('#main'))
                out.push({cat: cur, text: t, href: h.split('?')[0]});
            }
          }
          return out;
        }"""
    )
    await ctx.close()
    (OUT_DIR / "index_raw.json").write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"INDEX: {len(items)} entrees", flush=True)
    return items


async def scrape_one(browser, ctx, item, sem, results):
    async with sem:
        page = await ctx.new_page()
        slug = slugify(item["text"])
        entry = {"cat": item["cat"], "text": item["text"], "href": item["href"],
                 "slug": slug, "texts": [], "images": [], "warnings": []}
        # capture des bodies d'images au fil du chargement (pas de 2e requete)
        bodies = {}
        async def on_response(resp):
            try:
                url = resp.url
                if ("img.notionusercontent.com" in url or "/image/attachment" in url) and resp.status == 200:
                    ctype = (await resp.header_value("content-type") or "")
                    if "image" in ctype:
                        bodies[url] = resp
            except Exception:
                pass
        page.on("response", on_response)
        try:
            # goto avec retry : Notion rate-limite en rafale (TIMED_OUT/ABORTED vus dans les logs)
            loaded = False
            last_err = None
            for attempt in range(3):
                try:
                    await page.goto(item["href"], wait_until="domcontentloaded", timeout=35000)
                    loaded = True
                    break
                except Exception as e:
                    last_err = e
                    # laisse l'onglet respirer via une vraie attente reseau, pas un sleep
                    try:
                        await page.wait_for_load_state("domcontentloaded", timeout=5000)
                    except Exception:
                        pass
            if not loaded:
                entry["warnings"].append(f"goto echec x3: {type(last_err).__name__}")
                results.append(entry)
                print(f"[{len(results)}] {slug}: ECHEC goto / warns={entry['warnings']}", flush=True)
                return
            await page.wait_for_selector("main", timeout=30000)
            await dismiss_cookies(page)
            # attend le 1er bloc texte (le contenu reel, pas le squelette)
            try:
                await page.wait_for_selector("main [data-block-id]", timeout=30000)
            except Exception:
                entry["warnings"].append("pas de data-block-id")
            # revele chaque image : scrollIntoView + attente evenementielle complete
            try:
                n = await page.evaluate("() => document.querySelectorAll('main img').length")
            except Exception:
                n = 0
            for i in range(n):
                try:
                    await page.evaluate(
                        f"() => {{ const el = document.querySelectorAll('main img')[{i}]; "
                        f"if (el) el.scrollIntoView({{block: 'center'}}); }}"
                    )
                    await page.wait_for_function(
                        f"() => {{ const el = document.querySelectorAll('main img')[{i}]; "
                        f"return el && el.complete && el.naturalWidth > 200; }}",
                        polling=200, timeout=12000,
                    )
                except Exception as e:
                    entry["warnings"].append(f"img index {i} jamais complete: {type(e).__name__}")
            # Notion poll en continu : networkidle n'est presque jamais atteint (vu dans les logs),
            # on ne l'attend que 7s puis on avance sur la stabilite des tailles.
            try:
                await page.wait_for_load_state("networkidle", timeout=7000)
            except Exception:
                pass
            # verifie qu'aucune image n'est a moitie chargee (tailles stables entre 2 lectures)
            try:
                stable = await page.wait_for_function(
                    """() => {
                      const imgs = Array.from(document.querySelectorAll('main img'));
                      const sig = imgs.map(i => (i.currentSrc || i.src) + '#' + i.naturalWidth + 'x' + i.naturalHeight).join('|');
                      if (!window.__sig) { window.__sig = sig; window.__sigCount = 1; return false; }
                      if (sig === window.__sig) { window.__sigCount++; return window.__sigCount >= 3; }
                      window.__sig = sig; window.__sigCount = 1; return false;
                    }""",
                    polling=300, timeout=6000,
                )
            except Exception:
                entry["warnings"].append("tailles images instables (lazy-load incomplet?)")

            data = await page.evaluate(
                """() => {
                  const main = document.querySelector('main');
                  const title = document.title;
                  const texts = main ? Array.from(main.querySelectorAll('[data-block-id]'))
                    .map(e => (e.innerText || '').trim()).filter(t => t.length > 0).slice(0, 40) : [];
                  const imgs = Array.from(document.querySelectorAll('main img'))
                    .map(i => ({src: i.src, cur: i.currentSrc || '', w: i.naturalWidth, h: i.naturalHeight,
                                complete: i.complete}))
                    .filter(o => (o.src.includes('/image/') || o.cur.includes('notionusercontent')));
                  return {title, texts, imgs};
                }"""
            )
            entry["texts"] = data.get("texts", [])
            entry["title"] = data.get("title", item["text"])
            dest_dir = OUT_DIR / slug / "images"
            dest_dir.mkdir(parents=True, exist_ok=True)
            for idx, info in enumerate(data.get("imgs", []), start=1):
                if info.get("w", 0) <= 200 or not info.get("complete"):
                    entry["warnings"].append(f"img-{idx} rendu incomplet {info.get('w')}px")
                    continue
                # retrouve le body capture : d'abord currentSrc (URL signee), sinon src proxy
                body = None
                for cand in (info.get("cur"), info.get("src")):
                    if cand and cand in bodies:
                        body = bodies[cand]
                        break
                if body is None:
                    # cherche par attachment id dans les URLs capturees
                    aid = attachment_id(info.get("src", ""))
                    for u, r in bodies.items():
                        if aid and aid in u.lower():
                            body = r
                            break
                if body is None:
                    entry["warnings"].append(f"img-{idx} body non capture (reponse manquee)")
                    continue
                try:
                    raw = await body.body()
                    ctype = (await body.header_value("content-type") or "")
                    ext = ".webp" if "webp" in ctype else ".png"
                    if len(raw) < 8000:
                        entry["warnings"].append(f"img-{idx} body {len(raw)}o suspect")
                        continue
                    dest = dest_dir / f"img-{idx}{ext}"
                    dest.write_bytes(raw)
                    try:
                        from PIL import Image
                        import io
                        with Image.open(io.BytesIO(raw)) as im:
                            im.load()
                    except Exception as e:
                        entry["warnings"].append(f"img-{idx} PIL corrompu: {e}")
                        dest.unlink(missing_ok=True)
                        continue
                    entry["images"].append({
                        "file": dest.as_posix(),
                        "src": info.get("src"),
                        "final": info.get("cur"),
                        "attachment": attachment_id(info.get("src", "")),
                        "bytes": len(raw),
                        "size": [info.get("w"), info.get("h")],
                    })
                except Exception as e:
                    entry["warnings"].append(f"img-{idx} lecture body: {e}")
        except Exception as e:
            entry["warnings"].append(f"page echec: {type(e).__name__}: {e}")
        finally:
            try:
                page.remove_listener("response", on_response)
            except Exception:
                pass
            await page.close()
        results.append(entry)
        print(f"[{len(results)}] {slug}: {len(entry['images'])} img / warns={entry['warnings']}", flush=True)


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="chrome", headless=False,
                                           args=["--disable-blink-features=AutomationControlled"])
        items = await collect_index(browser)
        if LIMIT:
            items = items[:LIMIT]
        # reprend ou le run precedent s'est arrete : saute les slugs deja complets sur disque
        prev = []
        try:
            prev = json.loads((OUT_DIR / "scrape_data.json").read_text(encoding="utf-8"))
            done = {r["slug"] for r in prev if r.get("images")}
        except Exception:
            done = set()
        todo = [it for it in items if slugify(it["text"]) not in done]
        print(f"RESUME: {len(done)} deja faites, {len(todo)} restantes", flush=True)
        # pool de contextes partages (multitab) : 1 contexte ~ 1 profil, N onglets
        ctxs = [await browser.new_context(locale="fr-FR", viewport={"width": 1500, "height": 900})
                for _ in range(CONCURRENCY)]
        sem = asyncio.Semaphore(CONCURRENCY)
        results = list(prev)
        try:
            for i in range(0, len(todo), 9):
                chunk = todo[i:i + 9]
                await asyncio.gather(*(
                    scrape_one(browser, ctxs[k % CONCURRENCY], it, sem, results)
                    for k, it in enumerate(chunk)))
        finally:
            (OUT_DIR / "scrape_data.json").write_text(
                json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
            for c in ctxs:
                await c.close()
        (OUT_DIR / "scrape_data.json").write_text(
            json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        by_att = defaultdict(list)
        for r in results:
            for im in r["images"]:
                if im["attachment"]:
                    by_att[im["attachment"]].append(f"{r['slug']}/{im['file'].split('/')[-1]}")
        communs = {k: v for k, v in by_att.items() if len(v) > 1}
        (OUT_DIR / "capacites_communes.json").write_text(
            json.dumps(communs, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"TERMINE: {len(results)} fiches, {sum(len(r['images']) for r in results)} images", flush=True)
        print(f"COMMUNES: {len(communs)} attachments reutilises", flush=True)
        for k, v in sorted(communs.items(), key=lambda x: -len(x[1]))[:25]:
            print(f"  {k}: {v}", flush=True)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
