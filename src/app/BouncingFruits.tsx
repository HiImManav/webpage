"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

const SIZE = 80;
const HITBOX = SIZE * 0.45; // tighter collision radius
const WALL_INSET = 8;       // pixels of visual padding to ignore at edges
const SPEED = 2.2;
const CLICKS_TO_SPAWN = 5;
const FRUIT_CYCLE = ["lemon", "apple", "banana", "blueberry", "orange"];

interface FruitData {
  id: number;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  clicks: number;
}

function randomDirection(speed: number) {
  const angle = Math.random() * Math.PI * 2;
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

function normalizeSpeed(vx: number, vy: number, speed: number) {
  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag === 0) return randomDirection(speed);
  return { vx: (vx / mag) * speed, vy: (vy / mag) * speed };
}

export default function BouncingFruits() {
  const fruitsRef = useRef<FruitData[]>([]);
  const nextIdRef = useRef(1);
  const spawnIndexRef = useRef(0);
  const elRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [, setVersion] = useState(0);

  // initialize with orange
  useEffect(() => {
    const { vx, vy } = randomDirection(SPEED);
    fruitsRef.current = [
      {
        id: 0,
        type: "orange",
        x: Math.random() * (window.innerWidth - SIZE),
        y: Math.random() * (window.innerHeight - SIZE),
        vx,
        vy,
        rotation: 0,
        clicks: 0,
      },
    ];
    setVersion(1);
  }, []);

  // single animation loop for all fruits
  useEffect(() => {
    let raf: number;

    function tick() {
      const fruits = fruitsRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // move each fruit & wall-bounce
      for (const f of fruits) {
        f.x += f.vx;
        f.y += f.vy;
        f.rotation += 1.5;

        if (f.x <= -WALL_INSET || f.x >= w - SIZE + WALL_INSET) {
          f.x = Math.max(-WALL_INSET, Math.min(f.x, w - SIZE + WALL_INSET));
          f.vx = -f.vx;
          f.vy += (Math.random() - 0.5) * SPEED * 0.6;
          const n = normalizeSpeed(f.vx, f.vy, SPEED);
          f.vx = n.vx;
          f.vy = n.vy;
        }

        if (f.y <= -WALL_INSET || f.y >= h - SIZE + WALL_INSET) {
          f.y = Math.max(-WALL_INSET, Math.min(f.y, h - SIZE + WALL_INSET));
          f.vy = -f.vy;
          f.vx += (Math.random() - 0.5) * SPEED * 0.6;
          const n = normalizeSpeed(f.vx, f.vy, SPEED);
          f.vx = n.vx;
          f.vy = n.vy;
        }
      }

      // fruit-fruit collision
      for (let i = 0; i < fruits.length; i++) {
        for (let j = i + 1; j < fruits.length; j++) {
          const a = fruits[i];
          const b = fruits[j];

          const dx = (a.x + SIZE / 2) - (b.x + SIZE / 2);
          const dy = (a.y + SIZE / 2) - (b.y + SIZE / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = HITBOX;

          if (dist < minDist && dist > 0.1) {
            // separate overlapping fruits
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            a.x += nx * overlap / 2;
            a.y += ny * overlap / 2;
            b.x -= nx * overlap / 2;
            b.y -= ny * overlap / 2;

            // send both in random new directions
            const dirA = randomDirection(SPEED);
            const dirB = randomDirection(SPEED);
            a.vx = dirA.vx;
            a.vy = dirA.vy;
            b.vx = dirB.vx;
            b.vy = dirB.vy;
          }
        }
      }

      // update DOM transforms
      for (const f of fruits) {
        const el = elRefs.current.get(f.id);
        if (el) {
          el.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${f.rotation}deg)`;
        }
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleReset = useCallback(() => {
    const orange = fruitsRef.current.find((f) => f.id === 0);
    if (!orange) return;
    orange.clicks = 0;
    fruitsRef.current = [orange];
    spawnIndexRef.current = 0;
    setVersion((v) => v + 1);
  }, []);

  const handleClick = useCallback((id: number) => {
    const fruit = fruitsRef.current.find((f) => f.id === id);
    if (!fruit) return;

    // bounce in new direction
    const { vx, vy } = randomDirection(SPEED);
    fruit.vx = vx;
    fruit.vy = vy;

    // count clicks
    fruit.clicks++;
    if (fruit.clicks >= CLICKS_TO_SPAWN) {
      fruit.clicks = 0;

      // spawn next fruit in cycle
      const type = FRUIT_CYCLE[spawnIndexRef.current % FRUIT_CYCLE.length];
      spawnIndexRef.current++;

      const dir = randomDirection(SPEED);
      fruitsRef.current.push({
        id: nextIdRef.current++,
        type,
        x: Math.random() * (window.innerWidth - SIZE),
        y: Math.random() * (window.innerHeight - SIZE),
        vx: dir.vx,
        vy: dir.vy,
        rotation: 0,
        clicks: 0,
      });

      // re-render to create the new DOM element
      setVersion((v) => v + 1);
    }
  }, []);

  const fruitCount = fruitsRef.current.length;

  return (
    <>
      {fruitsRef.current.map((fruit) => (
        <div
          key={fruit.id}
          ref={(el) => {
            if (el) elRefs.current.set(fruit.id, el);
            else elRefs.current.delete(fruit.id);
          }}
          onClick={() => handleClick(fruit.id)}
          className="fixed top-0 left-0 z-0 cursor-pointer"
          style={{ width: SIZE, height: SIZE, willChange: "transform" }}
        >
          <Image
            src={`/${fruit.type}.png`}
            alt=""
            width={SIZE}
            height={SIZE}
            className="w-full h-full object-contain"
            priority={fruit.id === 0}
          />
        </div>
      ))}

      {fruitCount > 5 && (
        <button
          onClick={handleReset}
          className="fixed bottom-6 left-6 z-10 font-mono text-[0.75rem] tracking-[0.06em] lowercase px-4 py-2 bg-[var(--fg)] text-[var(--bg)] cursor-pointer rounded-none border-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          reset fruits
        </button>
      )}
    </>
  );
}
