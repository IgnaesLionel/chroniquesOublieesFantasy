"""Scraper lent et complet du Bestiaire Notion.
- Multi-onglets (3 pages concurrentes max) pour charger TOUTES les pages sans aller trop vite.
- Scroll lent + attente du chargement complet de chaque image (complete + naturalWidth).
- Telechargement via le contexte navigateur (cookies inclus) pour eviter les 403.
- Verification taille + integrite PIL pour detecter les images chargees de moitie.
"""
import asyncio
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import unquote

from playwright.async_api import async_playwright

BASE = "https://silver-pen-32f.notion.site"
INDEX_URL = f"{BASE}/Bestiaire-2edd3d06b0988074a972ce20c150046d"
OUT_DIR = Path("bestiaire")
OUT_DIR.mkdir(exist_ok=True)

CONCURRENCY = 3  # multitab limite pour laisser charger completement
SCROLL_STEP = 400
SCROLL_DELAY_MS = 400
IMG_WAIT_MS = 900


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
        for name in ["Tout refuser", "Tout accepter"]:
            btn = page.get_by_role("button", name=name)
            if await btn.count() > 0:
                await btn.first.click(timeout=3000)
                await page.wait_for_timeout(800)
                break
    except Exception:
        pass


async def slow_scroll_and_wait_images(page) -> int:
    """Scroll lent + attente que chaque image de main soit complete. Retourne nb images."""
    try:
        await page.wait_for_selector("main", timeout=30000)
    except Exception:
        return 0
    await dismiss_cookies(page)
    # hauteur totale
    try:
        height = await page.evaluate("() => document.body.scrollHeight")
    except Exception:
        height = 3000
    y = 0
    while y < height:
        await page.evaluate(f"() => window.scrollTo(0, {y})")
        await page.wait_for_timeout(SCROLL_DELAY_MS)
        y += SCROLL_STEP
        # re-evalue la hauteur (lazy load)
        try:
            height = max(height, await page.evaluate("() => document.body.scrollHeight"))
        except Exception:
            pass
    # remonte en haut puis passe sur chaque image une par une
    await page.evaluate("() => window.scrollTo(0, 0)")
    await page.wait_for_timeout(600)
    try:
        n = await page.evaluate("() => document.querySelectorAll('main img').length")
    except Exception:
        n = 0
    for i in range(n):
        try:
            await page.evaluate(
                f"() => {{ const imgs = document.querySelectorAll('main img'); const el = imgs[{i}]; if (el) el.scrollIntoView({{block: 'center'}}); }}"
            )
            await page.wait_for_timeout(IMG_WAIT_MS)
            # attend complete + largeur significative (evite les placeholders 1px et mi-charges)
            await page.wait_for_function(
                f"() => {{ const imgs = document.querySelectorAll('main img'); const el = imgs[{i}]; "
                f"return el && el.complete && el.naturalWidth > 200; }}",
                timeout=15000,
            )
        except Exception:
            # timeout sur une image : on continue mais on loguera une alerte taille
            pass
    # laisse le reseau se stabiliser (les .webp notion finissent de streamer)
    try:
        await page.wait_for_load_state("networkidle", timeout=20000)
    except Exception:
        await page.wait_for_timeout(2000)
    await page.wait_for_timeout(1200)
    return n


async def scrape_one(browser, item, sem, results):
    async with sem:
        ctx = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            viewport={"width": 1600, "height": 900},
            locale="fr-FR",
        )
        page = await ctx.new_page()
        slug = slugify(item["text"])
        entry = {
            "cat": item["cat"],
            "text": item["text"],
            "href": item["href"],
            "slug": slug,
            "texts": [],
            "images": [],
            "warnings": [],
        }
        try:
            await page.goto(item["href"], wait_until="domcontentloaded", timeout=60000)
            await slow_scroll_and_wait_images(page)
            data = await page.evaluate(
                """() => {
                  const main = document.querySelector('main');
                  const title = document.title;
                  const texts = main ? Array.from(main.querySelectorAll('[data-block-id]'))
                    .map(e => (e.innerText || '').trim()).filter(t => t.length > 0).slice(0, 40) : [];
                  const imgs = Array.from(document.querySelectorAll('main img'))
                    .map(i => ({src: i.src, w: i.naturalWidth, h: i.naturalHeight, complete: i.complete}))
                    .filter(o => o.src.includes('/image/'));
                  return {title, texts, imgs};
                }"""
            )
            entry["texts"] = data.get("texts", [])
            entry["title"] = data.get("title", item["text"])
            img_infos = data.get("imgs", [])
            # telechargement via le request context (cookies navigateur inclus)
            req = ctx.request
            dest_dir = OUT_DIR / slug / "images"
            dest_dir.mkdir(parents=True, exist_ok=True)
            for idx, info in enumerate(img_infos, start=1):
                src = info["src"]
                aid = attachment_id(src)
                # verifie rendu mi-charge
                if info.get("w", 0) <= 200 or not info.get("complete"):
                    entry["warnings"].append(f"img-{idx} rendu incomplet ({info.get('w')}px)")
                # GET avec cookies
                saved = None
                for attempt in range(3):
                    try:
                        resp = await req.get(src, timeout=30000)
                        if resp.status != 200:
                            await page.wait_for_timeout(1500)
                            continue
                        body = await resp.body()
                        ctype = resp.headers.get("content-type", "")
                        ext = ".webp" if "webp" in ctype else ".png"
                        if len(body) < 8000:
                            entry["warnings"].append(f"img-{idx} body trop petit ({len(body)}o), retry")
                            await page.wait_for_timeout(1500)
                            continue
                        saved = dest_dir / f"img-{idx}{ext}"
                        saved.write_bytes(body)
                        # verif PIL (detecte les fichiers tronques / moitie grise via load)
                        try:
                            from PIL import Image
                            with Image.open(saved) as im:
                                im.load()
                                w, h = im.size
                                if w < 200:
                                    entry["warnings"].append(f"img-{idx} PIL trop petit {w}x{h}")
                        except ImportError:
                            pass
                        except Exception as e:
                            entry["warnings"].append(f"img-{idx} PIL corrompu: {e}")
                            saved = None
                            await page.wait_for_timeout(1500)
                            continue
                        break
                    except Exception as e:
                        entry["warnings"].append(f"img-{idx} tentative {attempt+1} echec: {e}")
                        await page.wait_for_timeout(2000)
                if saved:
                    entry["images"].append({
                        "file": str(saved.as_posix()),
                        "src": src,
                        "attachment": aid,
                        "bytes": saved.stat().st_size,
                    })
                else:
                    entry["warnings"].append(f"img-{idx} ECHEC definitif {src[:120]}")
            # petit delai anti-rafale avant de liberer l'onglet
            await page.wait_for_timeout(500)
        except Exception as e:
            entry["warnings"].append(f"page echec: {e}")
        finally:
            await page.close()
            await ctx.close()
        results.append(entry)
        print(f"[{len(results)}] {slug} : {len(entry['images'])} img, {len(entry['warnings'])} warn", flush=True)
        return entry


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            channel="chrome",  # reutilise Chrome installe, pas de telechargement
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        # 1. index
        ctx0 = await browser.new_context(locale="fr-FR")
        p0 = await ctx0.new_page()
        await p0.goto(INDEX_URL, wait_until="domcontentloaded", timeout=60000)
        try:
            await p0.wait_for_selector("main", timeout=30000)
        except Exception:
            pass
        await dismiss_cookies(p0)
        # scroll lent de l'index pour tout reveler
        h = await p0.evaluate("() => document.body.scrollHeight")
        y = 0
        while y < h:
            await p0.evaluate(f"() => window.scrollTo(0, {y})")
            await p0.wait_for_timeout(300)
            y += 500
        items = await p0.evaluate(
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
        await p0.close()
        await ctx0.close()
        print(f"INDEX: {len(items)} entrees", flush=True)
        (OUT_DIR / "index_raw.json").write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

        sem = asyncio.Semaphore(CONCURRENCY)
        results = []
        # lance par vagues pour rester lent et stable (pas 115 d'un coup)
        for i in range(0, len(items), 12):
            chunk = items[i:i + 12]
            await asyncio.gather(*(scrape_one(browser, it, sem, results) for it in chunk))
            # pause entre vagues
            await asyncio.sleep(2)
        (OUT_DIR / "scrape_data.json").write_text(
            json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        # rapport capacites communes (meme attachment UUID reutilise)
        from collections import defaultdict
        by_att = defaultdict(list)
        for r in results:
            for im in r["images"]:
                if im["attachment"]:
                    by_att[im["attachment"]].append(f"{r['slug']}/{im['file'].split('/')[-1]}")
        communs = {k: v for k, v in by_att.items() if len(v) > 1}
        (OUT_DIR / "capacites_communes.json").write_text(
            json.dumps(communs, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"TERMINE: {len(results)} fiches, {sum(len(r['images']) for r in results)} images", flush=True)
        print(f"CAPACITES COMMUNES (attachments reutilises): {len(communs)}", flush=True)
        for k, v in sorted(communs.items(), key=lambda x: -len(x[1]))[:20]:
            print(f"  {k}: {v}", flush=True)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
