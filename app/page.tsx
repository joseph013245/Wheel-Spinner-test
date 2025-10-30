"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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

const Wheel = dynamic(() => import("react-custom-roulette").then((m) => m.Wheel), {
  ssr: false,
});

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
  spinning: boolean;
  currentSpinnerId: string | null;
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
    spinning: false,
    currentSpinnerId: null,
    countries: INITIAL_COUNTRIES,
    remainingPlayerIds: [],
    results: [],
  });

  const [usernameInput, setUsernameInput] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);

  // ✅ local wheel data (decoupled from Firebase)
  const [localCountries, setLocalCountries] = useState(INITIAL_COUNTRIES);
  const [localResults, setLocalResults] = useState<
    { playerName: string; country: string; flag: string }[]
  >([]);

  // --- Load saved player ---
  useEffect(() => {
    const id = localStorage.getItem("wheelPlayerId");
    const name = localStorage.getItem("wheelUsername");
    if (id && name) setMe({ id, username: name, joinedAt: Date.now() });
  }, []);

  // --- Firebase listeners ---
  useEffect(() => onValue(playersRef, (s) => setPlayers(s.val() || {})), []);
  useEffect(() => {
    return onValue(stateRef, (snap) => {
      const data = snap.val() || {
        started: false,
        spinning: false,
        currentSpinnerId: null,
        countries: INITIAL_COUNTRIES,
        remainingPlayerIds: [],
        results: [],
      };
      setState(data);

      // ✅ Update localCountries only when not spinning
      if (!spinning && Array.isArray(data.countries)) {
        setLocalCountries(data.countries);
      }
      if (!spinning && Array.isArray(data.results)) {
        setLocalResults(data.results);
      }
    });
  }, [spinning]);

  // --- Ensure room exists ---
  useEffect(() => {
    onValue(roomRef, (snap) => {
      if (!snap.val()) {
        const init: GameState = {
          started: false,
          spinning: false,
          currentSpinnerId: null,
          countries: INITIAL_COUNTRIES,
          remainingPlayerIds: [],
          results: [],
        };
        set(roomRef, { state: init, players: {} });
      }
    });
  }, []);

  // --- Join ---
  const handleJoin = async () => {
    const name = usernameInput.trim();
    if (!name) return;
    const newRef = push(playersRef);
    const id = newRef.key!;
    const player: Player = { id, username: name, joinedAt: Date.now(), lastSeen: Date.now() };
    await set(newRef, player);
    setMe(player);
    localStorage.setItem("wheelPlayerId", id);
    localStorage.setItem("wheelUsername", name);
  };

  // --- Heartbeat ---
  useEffect(() => {
    if (!me) return;
    const t = setInterval(() => {
      update(ref(db, `rooms/${ROOM_ID}/players/${me.id}`), { lastSeen: Date.now() });
    }, 5000);
    return () => clearInterval(t);
  }, [me]);

  const now = Date.now();
  const onlineIds = useMemo(
    () =>
      Object.values(players)
        .filter((p) => p.lastSeen && now - p.lastSeen < 15000)
        .map((p) => p.id),
    [players, now]
  );

  // --- Start Game ---
  const canStart = !state.started && Object.keys(players).length >= GAME_SIZE;
  const handleStart = async () => {
    if (!canStart) return;
    const ids = Object.keys(players);
    const initState: GameState = {
      started: true,
      spinning: false,
      currentSpinnerId: null,
      countries: INITIAL_COUNTRIES.slice(0, GAME_SIZE),
      remainingPlayerIds: ids,
      results: [],
    };
    await set(stateRef, initState);
  };

  // --- Auto pick spinner ---
  useEffect(() => {
    if (state.started && !state.currentSpinnerId && !state.spinning && state.remainingPlayerIds?.length) {
      runTransaction(stateRef, (curr: GameState | null) => {
        if (!curr || !curr.started || curr.currentSpinnerId || curr.spinning) return curr;
        const next = chooseRandom(curr.remainingPlayerIds);
        return { ...curr, currentSpinnerId: next };
      });
    }
  }, [state]);

  const amChosen = me?.id === state.currentSpinnerId;

  // --- Wheel data ---
  const wheelData = useMemo(
    () => localCountries.map((c) => ({ option: `${c.flag} ${c.name}` })),
    [localCountries]
  );

  // --- Spin ---
  const spin = async () => {
    if (!amChosen || spinning || state.spinning) return;
    const countries = localCountries;
    if (!countries.length) return;

    const index = Math.floor(Math.random() * countries.length);
    setPrizeNumber(index);
    setSpinning(true);

    await update(stateRef, { spinning: true });
  };

  // --- Stop spinning ---
  const onStopSpinning = async () => {
    const winning = localCountries[prizeNumber];
    if (!winning) {
      setSpinning(false);
      await update(stateRef, { spinning: false });
      return;
    }

    const playerName = players[state.currentSpinnerId!]?.username || "Unknown";
    const newCountries = localCountries.filter((_, i) => i !== prizeNumber);
    const newResults = [
      ...localResults,
      { playerName, country: winning.name, flag: winning.flag },
    ];

    setLocalCountries(newCountries);
    setLocalResults(newResults);
    setSpinning(false);

    await runTransaction(stateRef, (curr: GameState | null) => {
      if (!curr) return curr;
      const nextRemaining = curr.remainingPlayerIds.filter(
        (id) => id !== curr.currentSpinnerId
      );
      return {
        ...curr,
        countries: newCountries,
        remainingPlayerIds: nextRemaining,
        currentSpinnerId: null,
        spinning: false,
        results: newResults,
      };
    });
  };

  const resetRoom = async () => {
    await remove(roomRef);
    const init: GameState = {
      started: false,
      spinning: false,
      currentSpinnerId: null,
      countries: INITIAL_COUNTRIES,
      remainingPlayerIds: [],
      results: [],
    };
    await set(roomRef, { state: init, players: {} });
    setState(init);
    setLocalCountries(INITIAL_COUNTRIES);
    setLocalResults([]);
  };

  const currentSpinnerName = useMemo(() => {
    const id = state.currentSpinnerId;
    if (!id) return null;
    const p = players[id];
    const online = onlineIds.includes(id);
    return `${p?.username || "Unknown"}${online ? "" : " (offline)"}`;
  }, [state.currentSpinnerId, players, onlineIds]);

  const gameOver =
    state.started &&
    (state.results?.length || 0) >= GAME_SIZE &&
    (state.remainingPlayerIds?.length || 0) === 0;

  // --- UI ---
  return (
    <main className="container space-y-6">
      <header className="flex justify-between items-center">
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
            />
            <button className="btn btn-primary" onClick={handleJoin}>
              Join
            </button>
          </div>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">
          Lobby · Players ({Object.keys(players).length}/{GAME_SIZE})
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(players).map((p) => {
            const online = onlineIds.includes(p.id);
            return (
              <div
                key={p.id}
                className={`px-3 py-1 rounded-full ${
                  online
                    ? "bg-green-200 text-green-900 dark:bg-green-700"
                    : "bg-gray-200 dark:bg-neutral-800 opacity-60"
                }`}
              >
                {p.username}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={!canStart} onClick={handleStart}>
            Start game
          </button>
          <button className="btn btn-secondary" onClick={resetRoom}>
            Reset
          </button>
        </div>
      </section>

      {state.started && (
        <section className="card space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Game</h2>
            <div className="text-sm opacity-70">
              Remaining: {localCountries.length} countries ·{" "}
              {state.remainingPlayerIds?.length || 0} players
            </div>
          </div>

          <div className="text-sm">
            Current spinner: <b>{currentSpinnerName || "(waiting)"}</b>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="w-full max-w-[360px]">
              <Wheel
                mustStartSpinning={spinning}
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
              disabled={
                !amChosen ||
                spinning ||
                state.spinning ||
                gameOver ||
                localCountries.length === 0
              }
            >
              {amChosen
                ? spinning
                  ? "Spinning…"
                  : "Spin the wheel"
                : "Waiting for spinner"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {localResults.map((r, i) => (
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

          {gameOver && (
            <div className="text-center text-sm opacity-70">
              🎉 Game complete! You can reset to play again.
            </div>
          )}
        </section>
      )}
    </main>
  );
}