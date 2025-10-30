"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ref, onValue, set, push, onDisconnect, runTransaction } from "firebase/database";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";

const Wheel = dynamic(() => import("react-custom-roulette").then(m => m.Wheel), { ssr: false });

const GAME_SIZE = 3; // change later if needed
const INITIAL_COUNTRIES = [
  { name: "Japan", flag: "🇯🇵" },
  { name: "Brazil", flag: "🇧🇷" },
  { name: "Canada", flag: "🇨🇦" }
];
const ROOM_ID = "test-room";

interface Player { id: string; username: string; joinedAt: number; }
interface GameState {
  started: boolean;
  currentSpinnerId: string | null;
  countries: { name: string; flag: string }[];
  remainingPlayerIds: string[];
  results: { playerName: string; country: string; flag: string }[];
  spinning?: boolean;
  prizeNumber?: number | null;
}

const roomRef = ref(db, `rooms/${ROOM_ID}`);
const playersRef = ref(db, `rooms/${ROOM_ID}/players`);
const stateRef = ref(db, `rooms/${ROOM_ID}/state`);

function chooseRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function Page() {
  const [me, setMe] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [state, setState] = useState<GameState | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const wheelRef = useRef<any>(null);

  // Load from Firebase
  useEffect(() => onValue(playersRef, (snap) => setPlayers(snap.val() || {})), []);
  useEffect(() => onValue(stateRef, (snap) => setState(snap.val())), []);

  // Initialize game room if missing
  useEffect(() => {
    const off = onValue(roomRef, (snap) => {
      if (!snap.val()) {
        const initial: GameState = {
          started: false,
          currentSpinnerId: null,
          countries: INITIAL_COUNTRIES,
          remainingPlayerIds: [],
          results: [],
          spinning: false,
          prizeNumber: null
        };
        set(roomRef, { state: initial, players: {} });
      }
    });
    return () => off();
  }, []);

  const playerCount = useMemo(() => Object.keys(players).length, [players]);

  // Join game
  const handleJoin = async () => {
    const username = usernameInput.trim().slice(0, 20);
    if (!username) return;
    const newRef = push(playersRef);
    const meId = newRef.key!;
    const player: Player = { id: meId, username, joinedAt: Date.now() };
    await set(newRef, player);
    onDisconnect(newRef).remove();
    setMe(player);
  };

  // Start game safely
  const canStart = !state?.started && playerCount >= GAME_SIZE;
  const handleStart = async () => {
    if (!canStart) return;
    await runTransaction(stateRef, (curr: GameState | null) => {
      if (!curr || curr.started) return curr;
      const safeCountries = Array.isArray(curr.countries)
        ? curr.countries
        : INITIAL_COUNTRIES;
      const remainingPlayerIds = Object.keys(players);
      return {
        ...curr,
        started: true,
        currentSpinnerId: null,
        remainingPlayerIds,
        countries: safeCountries.slice(0, GAME_SIZE),
        results: [],
        spinning: false,
        prizeNumber: null
      };
    });
  };

  // Reset game completely
  const handleReset = async () => {
    await set(roomRef, null);
    await new Promise((res) => setTimeout(res, 300));
    await set(roomRef, {
      state: {
        started: false,
        currentSpinnerId: null,
        countries: INITIAL_COUNTRIES,
        remainingPlayerIds: [],
        results: [],
        spinning: false,
        prizeNumber: null
      },
      players: {}
    });
    setMe(null);
  };

  // Pick next player
  const canPickSpinner = state?.started && !state?.currentSpinnerId && (state?.remainingPlayerIds?.length || 0) > 0;
  const pickSpinner = async () => {
    if (!canPickSpinner) return;
    await runTransaction(stateRef, (curr: GameState | null) => {
      if (!curr || !curr.started || curr.currentSpinnerId || !curr.remainingPlayerIds.length) return curr;
      const chosen = chooseRandom(curr.remainingPlayerIds);
      return { ...curr, currentSpinnerId: chosen };
    });
  };

  // Make sure wheelData never breaks rendering
  const wheelData = useMemo(() => {
    if (!state?.countries || !Array.isArray(state.countries)) return [];
    return state.countries.map((c) => ({ option: `${c.flag} ${c.name}` }));
  }, [state?.countries]);

  // Spin
  const amChosen = me && state?.currentSpinnerId === me.id;
  const spin = async () => {
    if (!amChosen || spinning) return;
    const countries = state?.countries || [];
    if (!countries.length) return;
    const index = Math.floor(Math.random() * countries.length);
    setPrizeNumber(index);
    setSpinning(true);
    await set(stateRef, { ...state, spinning: true, prizeNumber: index });
  };

  // Stop spinning (shared across clients)
  useEffect(() => {
    if (state?.spinning && !spinning) {
      setSpinning(true);
      setPrizeNumber(state.prizeNumber ?? 0);
    } else if (!state?.spinning && spinning) {
      setSpinning(false);
    }
  }, [state?.spinning]);

  const onStopSpinning = async () => {
    setSpinning(false);
    await runTransaction(stateRef, (curr: GameState | null) => {
      if (!curr || !curr.currentSpinnerId) return curr;
      if (!curr.remainingPlayerIds.includes(curr.currentSpinnerId)) return curr;
      const winningCountry = curr.countries[curr.prizeNumber ?? 0];
      if (!winningCountry) return curr;
      const playerName = players[curr.currentSpinnerId]?.username || "Unknown";
      const nextRemaining = curr.remainingPlayerIds.filter(id => id !== curr.currentSpinnerId);
      const nextCountries = curr.countries.filter((_, i) => i !== (curr.prizeNumber ?? 0));
      return {
        ...curr,
        countries: nextCountries,
        remainingPlayerIds: nextRemaining,
        currentSpinnerId: null,
        spinning: false,
        prizeNumber: null,
        results: [...curr.results, { playerName, country: winningCountry.name, flag: winningCountry.flag }]
      };
    });
  };

  const currentSpinnerName = useMemo(
    () => state?.currentSpinnerId ? (players[state.currentSpinnerId]?.username || "(player)") : null,
    [state?.currentSpinnerId, players]
  );

  const gameOver = state?.started && (state?.results?.length || 0) >= GAME_SIZE;

  return (
    <main className="container space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🎡 Realtime Wheel Spinner (3)</h1>
        <span className="text-xs opacity-70">Room: test-room</span>
      </header>

      {!me && (
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Join the lobby</h2>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Enter a username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            <button className="btn btn-primary" onClick={handleJoin}>Join</button>
          </div>
          <p className="text-xs opacity-70">No password. Your spot is removed if you close the tab.</p>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Lobby · Players ({playerCount}/{GAME_SIZE})</h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(players).map((p) => (
            <div key={p.id} className="px-3 py-1 rounded-full bg-gray-100 dark:bg-neutral-800">
              {p.username}
            </div>
          ))}
          {playerCount === 0 && <div className="text-sm opacity-60">Waiting for players…</div>}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" disabled={!canStart} onClick={handleStart}>Start game</button>
          <button className="btn btn-secondary" onClick={handleReset}>Reset Game</button>
          {!canStart && <span className="text-xs opacity-70">Need {Math.max(0, GAME_SIZE - playerCount)} more to start</span>}
        </div>
      </section>

      {state?.started && (
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Game</h2>
            <div className="text-sm opacity-70">
              Remaining: {state.countries?.length ?? 0} countries · {state.remainingPlayerIds?.length ?? 0} players
            </div>
          </div>

          {state.countries?.length ? (
            <>
              <div className="text-sm">
                Chosen to spin:{" "}
                <span className="font-semibold">{currentSpinnerName || "(waiting)"}</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="w-full max-w-[360px]">
                  <Wheel
                    key={wheelData.map((d) => d.option).join("|")}
                    mustStartSpinning={spinning}
                    prizeNumber={prizeNumber}
                    data={wheelData}
                    onStopSpinning={onStopSpinning}
                    outerBorderColor={"#111"}
                    radiusLineColor={"#333"}
                    fontSize={14}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={spin}
                  disabled={!amChosen || spinning || gameOver || (state?.countries?.length ?? 0) === 0}
                >
                  {amChosen ? (spinning ? "Spinning…" : "Spin the wheel") : "Waiting for spinner"}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-sm opacity-80">🎉 Game complete! Refresh or reset to start again.</div>
          )}

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-1/2">Player</th>
                  <th className="w-1/2">Result</th>
                </tr>
              </thead>
              <tbody>
                {state.results?.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.playerName}</td>
                    <td>{r.flag} {r.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="text-center text-xs opacity-60 py-4">
        Works great on mobile — share this URL with testers.
      </footer>
    </main>
  );
}