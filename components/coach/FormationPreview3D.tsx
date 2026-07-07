"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getFormationSlots, type FormationSlot } from "@/lib/football/formations";

interface FormationPreview3DProps {
  formation: string;
  playerNames?: Record<string, string | undefined>;
}

const FIELD_WIDTH = 15.2;
const FIELD_LENGTH = 9.6;
const HALF_WIDTH = FIELD_WIDTH / 2;
const HALF_LENGTH = FIELD_LENGTH / 2;
const SURFACE_Y = 0.1;
const MIN_VISUAL_ROW_GAP = 0.135;
const MAX_VISUAL_Y = 0.88;
const MIN_VISUAL_Y = 0.23;

type DashboardTheme = "light" | "dark";
type DashboardLanguage = "en" | "ar";

const formationPositionLabels: Record<string, string> = {
  GK: "ح",
  LB: "ظ.أ",
  CB: "د",
  RB: "ظ.ي",
  CDM: "و.د",
  LM: "و.أ",
  CM: "و",
  RM: "و.ي",
  LW: "ج.أ",
  ST: "م",
  RW: "ج.ي",
  CF: "ر.ح",
};

function localizeFormationPosition(label: string, language: DashboardLanguage) {
  return language === "ar" ? formationPositionLabels[label] ?? label : label;
}

function useDashboardVisualMode() {
  const [mode, setMode] = useState<{
    theme: DashboardTheme;
    language: DashboardLanguage;
  }>({ theme: "light", language: "en" });

  useEffect(() => {
    const syncMode = () => {
      setMode({
        theme:
          document.documentElement.dataset.goalixDashboardTheme === "dark"
            ? "dark"
            : "light",
        language:
          document.documentElement.dataset.goalixDashboardLanguage === "ar"
            ? "ar"
            : "en",
      });
    };

    syncMode();
    const observer = new MutationObserver(syncMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "data-goalix-dashboard-theme",
        "data-goalix-dashboard-language",
      ],
    });
    return () => observer.disconnect();
  }, []);

  return mode;
}

function fitFontSize(context: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, minSize: number) {
  let size = startSize;
  while (size > minSize) {
    context.font = `800 ${size}px Arial`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

function makeLine(points: Array<[number, number, number]>, material: THREE.LineBasicMaterial) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 3;
  return line;
}

function makeArc(cx: number, cz: number, radius: number, start: number, end: number, material: THREE.LineBasicMaterial, segments = 36) {
  const points: Array<[number, number, number]> = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = start + ((end - start) * index) / segments;
    points.push([cx + Math.cos(angle) * radius, SURFACE_Y, cz + Math.sin(angle) * radius]);
  }
  return makeLine(points, material);
}

function makeTextSprite(
  text: string,
  options: {
    width?: number;
    height?: number;
    fontSize?: number;
    maxWidth?: number;
    background?: string;
    border?: string;
    color?: string;
    shadow?: string;
  } = {}
) {
  const canvas = document.createElement("canvas");
  canvas.width = options.width ?? 320;
  canvas.height = options.height ?? 96;
  const context = canvas.getContext("2d");

  if (context) {
    const fontSize = fitFontSize(context, text, options.maxWidth ?? 240, options.fontSize ?? 28, 12);
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (options.background) {
      context.shadowColor = options.shadow ?? "rgba(132, 204, 22, 0.18)";
      context.shadowBlur = 16;
      context.fillStyle = options.background;
      context.beginPath();
      context.roundRect(18, 18, canvas.width - 36, canvas.height - 36, 16);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = options.border ?? "rgba(125, 211, 252, 0.55)";
      context.lineWidth = 2;
      context.stroke();
    }

    context.fillStyle = options.color ?? "#f8fafc";
    context.font = `900 ${fontSize}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = options.shadow ?? "rgba(2, 6, 23, 0.95)";
    context.shadowBlur = 8;
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  }));
  sprite.renderOrder = 20;
  return sprite;
}

function makePitchTexture(theme: DashboardTheme) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 880;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const isDark = theme === "dark";
  const gradient = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 60, canvas.width / 2, canvas.height / 2, canvas.width * 0.75);
  gradient.addColorStop(0, isDark ? "#001728" : "#d9f8e6");
  gradient.addColorStop(0.58, isDark ? "#001320" : "#c7f0dd");
  gradient.addColorStop(1, isDark ? "#000916" : "#f8fffb");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = isDark ? 0.12 : 0.2;
  for (let y = 30; y < canvas.height; y += 34) {
    context.fillStyle = y % 68 === 0 ? (isDark ? "#02314a" : "#9bd9bd") : (isDark ? "#02253a" : "#bdebd2");
    context.fillRect(0, y, canvas.width, 1);
  }
  for (let x = 45; x < canvas.width; x += 74) {
    context.fillStyle = isDark ? "#032b43" : "#9adac2";
    context.fillRect(x, 0, 1, canvas.height);
  }

  context.globalAlpha = isDark ? 0.04 : 0.1;
  for (let index = 0; index < 80; index += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = 18 + Math.random() * 42;
    const spot = context.createRadialGradient(x, y, 0, x, y, radius);
    spot.addColorStop(0, isDark ? "#38bdf8" : "#2d9ad5");
    spot.addColorStop(1, "transparent");
    context.fillStyle = spot;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makePlayerBadgeSprite(
  position: string,
  isGoalkeeper: boolean,
  theme: DashboardTheme,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 280;
  canvas.height = 280;
  const context = canvas.getContext("2d");

  if (context) {
    const center = canvas.width / 2;
    const isDark = theme === "dark";
    const lime = isDark ? "#bfe85a" : "#0f7a45";
    const innerColor = isDark
      ? isGoalkeeper ? "#061d2f" : "#041427"
      : isGoalkeeper ? "#e4fff2" : "#f4fff8";

    context.clearRect(0, 0, canvas.width, canvas.height);

    const glow = context.createRadialGradient(center, center, 42, center, center, 116);
    glow.addColorStop(0, isDark ? "rgba(191, 232, 90, 0.12)" : "rgba(15, 122, 69, 0.16)");
    glow.addColorStop(0.56, isDark ? "rgba(191, 232, 90, 0.075)" : "rgba(45, 154, 213, 0.12)");
    glow.addColorStop(1, "rgba(200, 255, 18, 0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(center, center, 118, 0, Math.PI * 2);
    context.fill();

    context.shadowColor = isDark ? "rgba(191, 232, 90, 0.42)" : "rgba(15, 122, 69, 0.22)";
    context.shadowBlur = 12;
    context.strokeStyle = isDark ? "rgba(191, 232, 90, 0.78)" : "rgba(15, 122, 69, 0.78)";
    context.lineWidth = 6;
    context.lineCap = "round";
    context.beginPath();
    context.arc(center, center, 78, Math.PI * 0.68, Math.PI * 2.32);
    context.stroke();

    context.shadowBlur = 0;
    context.strokeStyle = isDark ? "rgba(236, 255, 170, 0.28)" : "rgba(45, 154, 213, 0.28)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(center, center, 78, Math.PI * 0.72, Math.PI * 2.28);
    context.stroke();

    context.shadowColor = isDark ? "rgba(2, 6, 23, 0.85)" : "rgba(15, 34, 25, 0.16)";
    context.shadowBlur = 14;
    const shell = context.createRadialGradient(center - 24, center - 32, 10, center, center, 72);
    shell.addColorStop(0, isDark ? (isGoalkeeper ? "#0f4863" : "#112947") : "#ffffff");
    shell.addColorStop(0.48, innerColor);
    shell.addColorStop(1, isDark ? "#010714" : "#d9f7e7");
    context.fillStyle = shell;
    context.beginPath();
    context.arc(center, center, 61, 0, Math.PI * 2);
    context.fill();

    context.shadowBlur = 0;
    context.strokeStyle = isDark ? "rgba(103, 232, 249, 0.34)" : "rgba(15, 122, 69, 0.26)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(center, center, 61, 0, Math.PI * 2);
    context.stroke();

    const highlight = context.createRadialGradient(center - 24, center - 30, 0, center - 24, center - 30, 42);
    highlight.addColorStop(0, "rgba(255, 255, 255, 0.22)");
    highlight.addColorStop(0.46, "rgba(255, 255, 255, 0.08)");
    highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = highlight;
    context.beginPath();
    context.ellipse(center - 18, center - 30, 30, 15, -0.25, 0, Math.PI * 2);
    context.fill();

    const fontSize = fitFontSize(context, position, 138, 60, 30);
    context.fillStyle = lime;
    context.font = `900 ${fontSize}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.shadowColor = isDark ? "rgba(191, 232, 90, 0.32)" : "rgba(255, 255, 255, 0.55)";
    context.shadowBlur = 6;
    context.fillText(position, center, center + 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  }));
  sprite.renderOrder = 24;
  return sprite;
}

function clampPitchX(x: number) {
  const expanded = 0.5 + (x - 0.5) * 1.08;
  return Math.min(0.94, Math.max(0.06, expanded));
}

function fieldPosition(slotX: number, slotY: number) {
  return {
    x: (clampPitchX(slotX) - 0.5) * FIELD_WIDTH,
    z: HALF_LENGTH - slotY * FIELD_LENGTH,
  };
}

function spreadVisualRows(slots: FormationSlot[]) {
  const rowYs = Array.from(new Set(slots.filter((slot) => slot.label !== "GK").map((slot) => Number(slot.y.toFixed(3))))).sort((a, b) => a - b);
  if (rowYs.length <= 1) return slots;

  let adjusted = [...rowYs];
  for (let index = 1; index < adjusted.length; index += 1) {
    adjusted[index] = Math.max(adjusted[index], adjusted[index - 1] + MIN_VISUAL_ROW_GAP);
  }

  const overflow = adjusted[adjusted.length - 1] - MAX_VISUAL_Y;
  if (overflow > 0) {
    adjusted = adjusted.map((value) => value - overflow);
  }

  const underflow = MIN_VISUAL_Y - adjusted[0];
  if (underflow > 0) {
    adjusted = adjusted.map((value) => value + underflow);
  }

  const rangeTooTight = adjusted[adjusted.length - 1] > MAX_VISUAL_Y;
  if (rangeTooTight) {
    const step = (MAX_VISUAL_Y - MIN_VISUAL_Y) / Math.max(adjusted.length - 1, 1);
    adjusted = adjusted.map((_, index) => MIN_VISUAL_Y + step * index);
  }

  const yMap = new Map(rowYs.map((value, index) => [value, adjusted[index]]));
  return slots.map((slot) => {
    if (slot.label === "GK") return slot;
    return {
      ...slot,
      y: yMap.get(Number(slot.y.toFixed(3))) ?? slot.y,
    };
  });
}

function makePlayerMarker(
  position: string,
  playerName: string | undefined,
  options: {
    isGoalkeeper: boolean;
    namePlacement: "above" | "below";
    theme: DashboardTheme;
  }
) {
  const group = new THREE.Group();
  const { isGoalkeeper, namePlacement, theme } = options;
  const isDark = theme === "dark";

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 48),
    new THREE.MeshBasicMaterial({
      color: isDark ? "#020617" : "#11301f",
      transparent: true,
      opacity: isDark ? 0.6 : 0.16,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1.68, 0.58, 1);
  shadow.position.set(0, 0.04, 0.12);
  shadow.renderOrder = 4;
  group.add(shadow);

  const badge = makePlayerBadgeSprite(position, isGoalkeeper, theme);
  badge.scale.set(1.28, 1.28, 1);
  badge.position.set(0, 0.88, 0.02);
  group.add(badge);

  if (playerName?.trim()) {
    const nameLabel = makeTextSprite(playerName.trim(), {
      width: 440,
      height: 110,
      fontSize: 42,
      maxWidth: 360,
      color: isDark ? "#f8fafc" : "#101914",
      shadow: isDark ? "rgba(0, 23, 40, 0.95)" : "rgba(255, 255, 255, 0.88)",
    });
    nameLabel.scale.set(1.62, 0.42, 1);
    nameLabel.position.set(0, namePlacement === "below" ? 0.22 : 1.6, namePlacement === "below" ? 0.3 : -0.16);
    group.add(nameLabel);
  }

  return group;
}

function addPitchLines(board: THREE.Group, theme: DashboardTheme) {
  const isDark = theme === "dark";
  const lineMaterial = new THREE.LineBasicMaterial({
    color: isDark ? "#0a3550" : "#0f7a45",
    transparent: true,
    opacity: isDark ? 0.95 : 0.42,
  });
  const glowLineMaterial = new THREE.LineBasicMaterial({
    color: isDark ? "#082d45" : "#2d9ad5",
    transparent: true,
    opacity: isDark ? 0.48 : 0.32,
  });
  const zoneMaterial = new THREE.LineBasicMaterial({
    color: isDark ? "#0f405a" : "#51b848",
    transparent: true,
    opacity: isDark ? 0.3 : 0.22,
  });
  const y = SURFACE_Y + 0.015;
  const left = -HALF_WIDTH + 0.18;
  const right = HALF_WIDTH - 0.18;
  const top = -HALF_LENGTH + 0.18;
  const bottom = HALF_LENGTH - 0.18;

  board.add(makeLine([[left, y, top], [right, y, top], [right, y, bottom], [left, y, bottom], [left, y, top]], lineMaterial));
  board.add(makeLine([[left - 0.16, y + 0.006, top - 0.12], [right + 0.16, y + 0.006, top - 0.12], [right + 0.16, y + 0.006, bottom + 0.12], [left - 0.16, y + 0.006, bottom + 0.12], [left - 0.16, y + 0.006, top - 0.12]], glowLineMaterial));

  board.add(makeLine([[left, y, 0], [right, y, 0]], lineMaterial));
  board.add(makeLine([[-2.25, y, top], [-2.25, y, top + 1.34], [2.25, y, top + 1.34], [2.25, y, top]], lineMaterial));
  board.add(makeLine([[-3.55, y, top], [-3.55, y, top + 2.05], [3.55, y, top + 2.05], [3.55, y, top]], lineMaterial));
  board.add(makeLine([[-0.78, y, top], [-0.78, y, top + 0.43], [0.78, y, top + 0.43], [0.78, y, top]], lineMaterial));

  board.add(makeLine([[-2.25, y, bottom], [-2.25, y, bottom - 1.34], [2.25, y, bottom - 1.34], [2.25, y, bottom]], lineMaterial));
  board.add(makeLine([[-3.55, y, bottom], [-3.55, y, bottom - 2.05], [3.55, y, bottom - 2.05], [3.55, y, bottom]], lineMaterial));
  board.add(makeLine([[-0.78, y, bottom], [-0.78, y, bottom - 0.43], [0.78, y, bottom - 0.43], [0.78, y, bottom]], lineMaterial));

  board.add(makeArc(0, 0, 1.06, 0, Math.PI * 2, lineMaterial, 80));
  board.add(makeArc(0, top + 1.68, 1.05, 0.12, Math.PI - 0.12, glowLineMaterial, 48));
  board.add(makeArc(0, bottom - 1.68, 1.05, Math.PI + 0.12, Math.PI * 2 - 0.12, glowLineMaterial, 48));

  board.add(makeArc(left + 0.12, top + 0.12, 0.24, 0, Math.PI / 2, lineMaterial, 12));
  board.add(makeArc(right - 0.12, top + 0.12, 0.24, Math.PI / 2, Math.PI, lineMaterial, 12));
  board.add(makeArc(right - 0.12, bottom - 0.12, 0.24, Math.PI, Math.PI * 1.5, lineMaterial, 12));
  board.add(makeArc(left + 0.12, bottom - 0.12, 0.24, Math.PI * 1.5, Math.PI * 2, lineMaterial, 12));

  [-0.68, 0.68].forEach((x) => {
    board.add(makeLine([[x * HALF_WIDTH, y, top], [x * HALF_WIDTH, y, bottom]], zoneMaterial));
  });
  [-0.5, 0.5].forEach((z) => {
    board.add(makeLine([[left, y, z * HALF_LENGTH], [right, y, z * HALF_LENGTH]], zoneMaterial));
  });

  const centerSpot = new THREE.Mesh(
    new THREE.CircleGeometry(0.055, 24),
    new THREE.MeshBasicMaterial({
      color: isDark ? "#2d5a70" : "#0f7a45",
      transparent: true,
      opacity: 0.82,
    })
  );
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.set(0, y + 0.01, 0);
  centerSpot.renderOrder = 5;
  board.add(centerSpot);
}

export function FormationPreview3D({ formation, playerNames = {} }: FormationPreview3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerNameKey = JSON.stringify(playerNames);
  const { theme, language } = useDashboardVisualMode();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isDark = theme === "dark";
    const resolvedPlayerNames = JSON.parse(playerNameKey) as Record<string, string | undefined>;

    const width = container.clientWidth || 860;
    const height = container.clientHeight || 560;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(37, width / height, 0.1, 100);
    camera.position.set(0, 8.9, 8.45);
    camera.lookAt(0, 0.05, -0.24);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.replaceChildren(renderer.domElement);

    scene.add(new THREE.AmbientLight(isDark ? "#dbeafe" : "#ffffff", isDark ? 1.2 : 1.55));

    const mainLight = new THREE.DirectionalLight("#ffffff", isDark ? 1.8 : 1.45);
    mainLight.position.set(1.5, 8, 4.5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const neonLight = new THREE.PointLight(isDark ? "#0e7490" : "#51b848", isDark ? 1.8 : 1.15, 20);
    neonLight.position.set(0, 2.2, 0);
    scene.add(neonLight);

    const rimLight = new THREE.DirectionalLight(isDark ? "#67e8f9" : "#2d9ad5", isDark ? 0.85 : 0.55);
    rimLight.position.set(-4, 5, -4);
    scene.add(rimLight);

    const board = new THREE.Group();
    board.position.set(0, -0.03, -0.08);
    scene.add(board);

    const fitViewport = (nextWidth: number, nextHeight: number) => {
      const aspect = nextWidth / nextHeight;
      const scale = aspect < 0.85 ? 0.38 : aspect < 1.25 ? 0.68 : 0.82;
      board.scale.set(scale, scale, scale);
      camera.position.set(0, aspect < 0.85 ? 10.8 : 8.9, aspect < 0.85 ? 12.6 : 8.45);
      camera.lookAt(0, 0.05, aspect < 0.85 ? -0.05 : -0.24);
    };

    const boardBase = new THREE.Mesh(
      new THREE.BoxGeometry(FIELD_WIDTH + 1.05, 0.06, FIELD_LENGTH + 0.78),
      new THREE.MeshBasicMaterial({
        color: isDark ? "#000d18" : "#ffffff",
        transparent: true,
        opacity: isDark ? 0.62 : 0.74,
        depthWrite: false,
      })
    );
    boardBase.position.y = -0.04;
    boardBase.renderOrder = 0;
    board.add(boardBase);

    const pitchTexture = makePitchTexture(theme);
    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_LENGTH),
      new THREE.MeshStandardMaterial({
        map: pitchTexture ?? undefined,
        color: isDark ? "#001728" : "#e8fbef",
        transparent: true,
        opacity: isDark ? 0.98 : 0.96,
        roughness: isDark ? 0.68 : 0.76,
        metalness: isDark ? 0.08 : 0.02,
      })
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0;
    pitch.receiveShadow = true;
    board.add(pitch);

    const edgeGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_WIDTH + 0.52, FIELD_LENGTH + 0.42),
      new THREE.MeshBasicMaterial({
        color: isDark ? "#001728" : "#51b848",
        transparent: true,
        opacity: isDark ? 0.08 : 0.06,
        depthWrite: false,
      })
    );
    edgeGlow.rotation.x = -Math.PI / 2;
    edgeGlow.position.y = -0.015;
    board.add(edgeGlow);

    addPitchLines(board, theme);

    spreadVisualRows(getFormationSlots(formation)).forEach((slot) => {
      const isGoalkeeper = slot.label === "GK";
      const namePlacement = slot.line === "defense" && !isGoalkeeper ? "below" : "above";
      const player = makePlayerMarker(
        localizeFormationPosition(slot.label, language),
        resolvedPlayerNames[slot.id],
        { isGoalkeeper, namePlacement, theme },
      );
      const position = fieldPosition(slot.x, slot.y);
      player.position.set(position.x, 0.12, position.z);
      board.add(player);
    });

    fitViewport(width, height);
    renderer.render(scene, camera);

    const resize = () => {
      const nextWidth = container.clientWidth || width;
      const nextHeight = container.clientHeight || height;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      fitViewport(nextWidth, nextHeight);
      renderer.setSize(nextWidth, nextHeight);
      renderer.render(scene, camera);
    };
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
        }
        if (object instanceof THREE.Mesh && Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else if (object instanceof THREE.Mesh) {
          object.material.dispose();
        }
        if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      pitchTexture?.dispose();
      container.replaceChildren();
    };
  }, [formation, language, playerNameKey, theme]);

  return (
    <div
      ref={containerRef}
      className="goalix-formation-preview h-[560px] min-h-[500px] overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(226,255,238,0.78),rgba(244,250,247,0.92)_58%,rgba(255,255,255,1)_100%)] dark:bg-[radial-gradient(circle_at_50%_35%,rgba(0,23,40,0.68),rgba(2,6,23,0.9)_58%,rgba(2,6,23,1)_100%)]"
    />
  );
}
