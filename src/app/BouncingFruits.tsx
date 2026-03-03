"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

const SIZE = 80;
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

        if (f.x <= 0 || f.x >= w - SIZE) {
          f.x = Math.max(0, Math.min(f.x, w - SIZE));
          f.vx = -f.vx;
          f.vy += (Math.random() - 0.5) * SPEED * 0.6;
          const n = normalizeSpeed(f.vx, f.vy, SPEED);
          f.vx = n.vx;
          f.vy = n.vy;
        }

        if (f.y <= 0 || f.y >= h - SIZE) {
          f.y = Math.max(0, Math.min(f.y, h - SIZE));
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
          const minDist = SIZE * 0.75;

          if (dist < minDist && dist > 0) {
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
    </>
  );
}
