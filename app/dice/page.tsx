import { DiceRoller } from "@/src/components/dice/DiceRoller";

export default function DicePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dés</h1>
      <DiceRoller />
    </div>
  );
}
