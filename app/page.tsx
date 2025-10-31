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
import StableWheel from "./StableWheel";

const GAME_SIZE = 8;
const INITIAL_COUNTRIES = [
  { name: "Italy", flag: "🇮🇹" },
  { name: "Spain", flag: "🇪🇸" },
  { name: "Greece", flag: "🇬🇷" },
  { name: "Mexico", flag: "🇲🇽" },
  { name: "France", flag: "🇫🇷" },
  { name: "Thailand", flag: "🇹🇭" },
  { name: "Japan", flag: "🇯🇵" },
  { name: "UK & R.O.I", flag: "🇬🇧🇮🇪" },
];
const ROOM_ID = "blanket-banquet-2025";

interface Player {
  id: string;
  username: string;
  joinedAt: number;
  lastSeen?: number;
}

interface GameState {
  started: boolean;
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
    currentSpinnerId: null,
    countries: INITIAL_COUNTRIES,
    remainingPlayerIds: [],
    results: [],
  });
  const [usernameInput, setUsernameInput] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [spinToken, setSpinToken] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);

  // Firebase watchers
  useEffect(() => {
    return onValue(playersRef, (snap) => {
      setPlayers(snap.val() || {});
    });
  }, []);
  useEffect(() => {
    return onValue(stateRef, (snap) => {
      const data = snap.val() || {
        started: false,
        currentSpinnerId: null,
        countries: INITIAL_COUNTRIES,
        remainingPlayerIds: [],
        results: [],
      };
      setState(data);
      const done =
        data.started &&
        (data.results?.length || 0) >= GAME_SIZE &&
        (data.remainingPlayerIds?.length || 0) === 0;
      setGameComplete(done);
    });
  }, []);

  // Ensure room exists
  useEffect(() => {
    const off = onValue(roomRef, (snap) => {
      if (!snap.val()) {
        const initial: GameState = {
          started: false,
          currentSpinnerId: null,
          countries: INITIAL_COUNTRIES,
          remainingPlayerIds: [],
          results: [],
        };
        set(roomRef, { state: initial, players: {} });
      }
    });
    return () => off();
  }, []);

  const playerCount = useMemo(() => Object.keys(players || {}).length, [players]);

  // Join or rejoin
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
  const handleManualRejoin = async (id: string, username: string) => {
    const playerSnap = await get(ref(db, `rooms/${ROOM_ID}/players/${id}`));
    if (!playerSnap.exists()) return alert("That player no longer exists.");
    const player = playerSnap.val() as Player;
    setMe(player);
    localStorage.setItem("wheelPlayerId", id);
    localStorage.setItem("wheelUsername", username);
  };

  // Heartbeat
  useEffect(() => {
    if (!me) return;
    const interval = setInterval(() => {
      update(ref(db, `rooms/${ROOM_ID}/players/${me.id}`), { lastSeen: Date.now() });
    }, 5000);
    return () => clearInterval(interval);
  }, [me]);

  // Online check
  const now = Date.now();
  const onlinePlayerIds = useMemo(
    () =>
      Object.values(players)
        .filter((p) => p.lastSeen && now - p.lastSeen < 15000)
        .map((p) => p.id),
    [players, now]
  );

  // Start game
  const canStart = !state?.started && playerCount >= GAME_SIZE;
  const handleStart = async () => {
    if (!canStart) return;
    await runTransaction(stateRef, (curr: GameState | null) => {
      if (!curr || curr.started) return curr;
      const remaining = Object.keys(players || {});
      return { ...curr, started: true, remainingPlayerIds: remaining, results: [] };
    });
    setGameComplete(false);
  };

  // Auto-choose spinner
  useEffect(() => {
    if (state?.started && !state?.currentSpinnerId && (state?.remainingPlayerIds?.length || 0) > 0) {
      runTransaction(stateRef, (curr: GameState | null) => {
        if (!curr || !curr.started || curr.currentSpinnerId || !curr.remainingPlayerIds.length)
          return curr;
        const chosen = chooseRandom(curr.remainingPlayerIds);
        if (!chosen) return curr;
        return { ...curr, currentSpinnerId: chosen };
      });
    }
  }, [state?.started, state?.currentSpinnerId, state?.remainingPlayerIds]);

  const amChosen = me && state?.currentSpinnerId === me.id;
  const wheelData = useMemo(() => {
    if (!Array.isArray(state?.countries) || state.countries.length === 0) {
      return [{ option: "🎡 Waiting…" }];
    }
    return state.countries.map((c) => ({ option: `${c.flag} ${c.name}` }));
  }, [state?.countries]);

  const spin = async () => {
    if (!amChosen || spinning) return;
    const countries = state?.countries || [];
    const index = Math.floor(Math.random() * countries.length);
    setPrizeNumber(index);
    setSpinning(true);
    setSpinToken((t) => t + 1);
  };

  const onWheelFinished = async () => {
    setSpinning(false);
    await runTransaction(stateRef, (curr: GameState | null) => {
      if (!curr || !curr.currentSpinnerId) return curr;
      if (!curr.remainingPlayerIds.includes(curr.currentSpinnerId)) return curr;
      if (!curr.countries[prizeNumber]) return curr;
      const winning = curr.countries[prizeNumber];
      const name = players[curr.currentSpinnerId]?.username || "Unknown";
      const nextRemaining = curr.remainingPlayerIds.filter((id) => id !== curr.currentSpinnerId);
      const nextCountries = curr.countries.filter((_, i) => i !== prizeNumber);
      const finished = nextRemaining.length === 0 || nextCountries.length === 0;
      return {
        ...curr,
        countries: nextCountries,
        remainingPlayerIds: nextRemaining,
        currentSpinnerId: null,
        results: [...(curr.results || []), { playerName: name, country: winning.name, flag: winning.flag }],
        started: curr.started,
      };
    });
    if (state.remainingPlayerIds.length <= 1 || state.countries.length <= 1) setGameComplete(true);
  };

  const resetRoom = async () => {
    await remove(roomRef);
    const initial: GameState = {
      started: false,
      currentSpinnerId: null,
      countries: INITIAL_COUNTRIES,
      remainingPlayerIds: [],
      results: [],
    };
    await set(roomRef, { state: initial, players: {} });
    setMe(null);
    setPlayers({});
    setState(initial);
    setGameComplete(false);
  };

  const currentSpinnerName = useMemo(() => {
    const id = state?.currentSpinnerId;
    if (!id) return null;
    const player = players?.[id];
    const isOnline = onlinePlayerIds.includes(id);
    return `${player?.username ?? "(previous)"}${isOnline ? "" : " (offline)"}`;
  }, [state?.currentSpinnerId, players, onlinePlayerIds]);

  return (
    <main className="container space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🎡 Blanket Banquet 2025 Twist</h1>
        <span className="text-xs opacity-70">Room: {ROOM_ID}</span>
      </header>

      {!me && (
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Join the lobby</h2>
          {Object.keys(players || {}).length > 0 && (
            <div className="p-3 border rounded-md bg-gray-100 dark:bg-neutral-800">
              <p className="text-sm font-medium mb-2">Rejoin as an existing player:</p>
              <div className="flex flex-wrap gap-2">
                {Object.values(players).map((p) => (
                  <button
                    key={p.id}
                    className="px-3 py-1 rounded-full text-sm font-medium 
                               bg-gray-200 text-gray-800 hover:bg-gray-300
                               dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600
                               transition-colors"
                    onClick={() => handleManualRejoin(p.id, p.username)}
                  >
                    {p.username}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="text-center text-xs opacity-60 my-2">— or join as a new player —</div>
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

      {/* Players */}
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">
          Lobby · Players ({playerCount}/{GAME_SIZE})
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(players || {}).map((p) => {
            const online = onlinePlayerIds.includes(p.id);
            return (
              <div
                key={p.id}
                className={`px-3 py-1 rounded-full ${
                  online
                    ? "bg-green-200 text-green-900 dark:bg-green-700"
                    : "bg-gray-100 dark:bg-neutral-800 opacity-60"
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

      {/* Game */}
      {state?.started && (
        <section className="card space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Game</h2>
            <div className="text-sm opacity-70">
              Remaining: {(state?.countries?.length || 0)} countries ·{" "}
              {(state?.remainingPlayerIds?.length || 0)} players
            </div>
          </div>

          {!gameComplete && (
            <>
              <div className="text-sm">
                Chosen to spin:{" "}
                <span className="font-semibold">{currentSpinnerName || "(waiting)"}</span>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="w-full max-w-[360px]">
                  <StableWheel
                    data={wheelData}
                    triggerToken={spinToken}
                    prizeNumber={prizeNumber}
                    onFinished={onWheelFinished}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  onClick={spin}
                  disabled={!amChosen || spinning || gameComplete}
                >
                  {amChosen
                    ? spinning
                      ? "Spinning…"
                      : "Spin the wheel"
                    : "Waiting for spinner"}
                </button>
              </div>
            </>
          )}

          {/* Results */}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {(state?.results ?? []).map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.playerName}</td>
                    <td>
                      {r.flag} {r.country}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {gameComplete && (
            <div className="text-center text-sm opacity-80">
              🎉 Game complete! You can reset to play again.
            </div>
          )}
        </section>
      )}

      <footer className="text-center text-xs opacity-60 py-4">
        Works great on mobile — share this URL with testers.
      </footer>
    </main>
  );
}