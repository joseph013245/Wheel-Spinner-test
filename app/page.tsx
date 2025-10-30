"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ref,
  onValue,
  set,
  push,
  runTransaction,
  remove,
  get,
  update,
} from "firebase/database";
import { db } from "@/lib/firebase";
import dynamic from "next/dynamic";

const Wheel = dynamic(
  () => import("react-custom-roulette").then((m) => m.Wheel),
  { ssr: false }
);

const GAME_SIZE = 3;
const INITIAL_COUNTRIES = [
  { name: "Japan", flag: "🇯🇵" },
  { name: "Brazil", flag: "🇧🇷" },
  { name: "Canada", flag: "🇨🇦" },
];
const ROOM_ID = "test-room";

interface Player {
  id: string;
  username: string;
  joinedAt: number;
  lastSeen?: number;
}

interface GameState {
  started: boolean;
  currentSpinnerId: string | null;
  spinning: boolean;
  countries: { name: string; flag: string }[];
  remainingPlayerIds: string[];
  results: { playerName: string; country: string; flag: string }[];
}

const roomRef = ref(db, `rooms/${ROOM_ID}`);
const playersRef = ref(db, `rooms/${ROOM_ID}/players`);
const stateRef = ref(db, `rooms/${ROOM_ID}/state`);

function chooseRandom<T>(arr: T[]): T | null {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function Page() {
  const [me, setMe] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [state, setState] = useState<GameState>({
    started: false,
    currentSpinnerId: null,
    spinning: false,
    countries: INITIAL_COUNTRIES,
    remainingPlayerIds: [],
    results: [],
  });
  const [usernameInput, setUsernameInput] = useState("");
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [spinningLocal, setSpinningLocal] = useState(false);

  // Load saved player from localStorage
  useEffect(() => {
    const savedId = localStorage.getItem("wheelPlayerId");
    const savedName = localStorage.getItem("wheelUsername");
    if (savedId && savedName)
      setMe({ id: savedId, username: savedName, joinedAt: Date.now() });
  }, []);

  // Watch Firebase
  useEffect(() => onValue(playersRef, (snap) => setPlayers(snap.val() || {})), []);
  useEffect(() =>
    onValue(stateRef, (snap) => {
      const data =
        snap.val() || {
          started: false,
          currentSpinnerId: null,
          spinning: false,
          countries: INITIAL_COUNTRIES,
          remainingPlayerIds: [],
          results: [],
        };
      setState(data);
    }),
    []
  );

  // Ensure room exists (but don't block other players from joining)
  useEffect(() => {
    const unsub = onValue(roomRef, async (snap) => {
      const data = snap.val();
      // If the room doesn't exist at all, create it
      if (!data) {
        const initial: GameState = {
          started: false,
          currentSpinnerId: null,
          spinning: false,
          countries: INITIAL_COUNTRIES,
          remainingPlayerIds: [],
          results: [],
        };
        await set(roomRef, { state: initial, players: {} });
      }
    });
    return () => unsub();
  }, []);

  const playerCount = Object.keys(players || {}).length;

  // Join
  const handleJoin = async () => {
    const username = usernameInput.trim().slice(0, 20);
    if (!username) return;

    const newRef = push(playersRef);
    const meId = newRef.key!;
    const player: Player = { id: meId, username, joinedAt: Date.now(), lastSeen: Date.now() };

    await set(newRef, player);
    setMe(player);
    localStorage.setItem("wheelPlayerId", meId);
    localStorage.setItem("wheelUsername", username);
  };

  // Heartbeat system
  useEffect(() => {
    if (!me) return;
    const interval = setInterval(() => {
      update(ref(db, `rooms/${ROOM_ID}/players/${me.id}`), { lastSeen: Date.now() });
    }, 5000);
    return () => clearInterval(interval);
  }, [me]);

  const now = Date.now();
  const onlinePlayerIds = Object.values(players)
    .filter((p) => p.lastSeen && now - p.lastSeen < 15000)
    .map((p) => p.id);

  // Start game
  const canStart = !state.started && playerCount >= GAME_SIZE;
  const handleStart = async () => {
    if (!canStart) return;
    await set(stateRef, {
      started: true,
      currentSpinnerId: null,
      spinning: false,
      countries: INITIAL_COUNTRIES.slice(0, GAME_SIZE),
      remainingPlayerIds: Object.keys(players),
      results: [],
    });
  };

  // Auto-pick spinner
  useEffect(() => {
    if (
      state.started &&
      !state.currentSpinnerId &&
      !state.spinning &&
      (state.remainingPlayerIds?.length || 0) > 0
    ) {
      const chosen = chooseRandom(state.remainingPlayerIds);
      if (chosen) update(stateRef, { currentSpinnerId: chosen });
    }
  }, [state]);

  const amChosen = me && state.currentSpinnerId === me.id;
  const wheelData = (state.countries || []).map((c) => ({ option: `${c.flag} ${c.name}` }));

  // SPIN FUNCTION
  const spin = async () => {
    if (!amChosen || state.spinning) return;
    const index = Math.floor(Math.random() * (state.countries?.length || 1));

    // lock for everyone
    await update(stateRef, { spinning: true });

    // Local smooth spin
    setPrizeNumber(index);
    setSpinningLocal(true);
  };

  // AFTER spin stops
  const onStopSpinning = async () => {
    setSpinningLocal(false);
    const winningCountry = state.countries[prizeNumber];
    if (!winningCountry) return;

    // update firebase once wheel has stopped
    await runTransaction(stateRef, (curr: GameState | null) => {
      if (!curr) return curr;
      const spinnerId = curr.currentSpinnerId;
      if (!spinnerId) return curr;

      const playerName = players[spinnerId]?.username || "Unknown";
      const nextRemaining = curr.remainingPlayerIds.filter((id) => id !== spinnerId);
      const nextCountries = curr.countries.filter((_, i) => i !== prizeNumber);

      return {
        ...curr,
        spinning: false,
        countries: nextCountries,
        remainingPlayerIds: nextRemaining,
        currentSpinnerId: null,
        results: [
          ...(curr.results || []),
          { playerName, country: winningCountry.name, flag: winningCountry.flag },
        ],
      };
    });
  };

  const resetRoom = async () => {
    await remove(roomRef);
    const initial: GameState = {
      started: false,
      currentSpinnerId: null,
      spinning: false,
      countries: INITIAL_COUNTRIES,
      remainingPlayerIds: [],
      results: [],
    };
    await set(roomRef, { state: initial, players: {} });
    setMe(null);
    alert("Room has been reset.");
  };

  const currentSpinnerName = state.currentSpinnerId
    ? players[state.currentSpinnerId]?.username || "Unknown"
    : null;

  const gameOver = state.started && (state.results?.length || 0) >= GAME_SIZE;

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
            <button className="btn btn-primary" onClick={handleJoin}>
              Join
            </button>
          </div>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">
          Lobby · Players ({playerCount}/{GAME_SIZE})
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(players).map((p) => (
            <div
              key={p.id}
              className={`px-3 py-1 rounded-full ${
                onlinePlayerIds.includes(p.id)
                  ? "bg-green-200 text-green-900 dark:bg-green-700"
                  : "bg-gray-100 dark:bg-neutral-800 opacity-60"
              }`}
            >
              {p.username}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-primary"
            disabled={!canStart}
            onClick={handleStart}
          >
            Start game
          </button>
          <button className="btn btn-secondary" onClick={resetRoom}>
            Reset Game
          </button>
        </div>
      </section>

      {state.started && (
        <section className="card space-y-4">
          {!gameOver && (
            <>
              <div className="text-center font-semibold">
                {state.spinning
                  ? "🌀 Wheel spinning…"
                  : currentSpinnerName
                  ? `🎯 It's ${currentSpinnerName}'s turn!`
                  : "Waiting for spinner..."}
              </div>

              {state.countries.length > 0 && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-full max-w-[360px]">
                    <Wheel
                      mustStartSpinning={spinningLocal}
                      prizeNumber={prizeNumber}
                      data={wheelData}
                      onStopSpinning={onStopSpinning}
                      outerBorderColor="#111"
                      radiusLineColor="#333"
                      fontSize={14}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={spin}
                    disabled={!amChosen || state.spinning || spinningLocal}
                  >
                    {amChosen
                      ? spinningLocal
                        ? "Spinning..."
                        : "Spin the wheel"
                      : "Waiting..."}
                  </button>
                </div>
              )}
            </>
          )}

          {gameOver && (
            <div className="text-center text-sm opacity-80">
              🎉 Game complete! Final results below.
            </div>
          )}

          <div className="overflow-x-auto mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {(state.results ?? []).map((r, i) => (
                  <tr key={i}>
                    <td>{r.playerName}</td>
                    <td>
                      {r.flag} {r.country}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}