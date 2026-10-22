"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * The Living Electorate Swarm
 * 
 * An interactive, playful campus quad simulation featuring dozens of tiny,
 * stylized student voters milling across the hero area.
 * 
 * Features:
 * - Tiny stylized students (~18px tall) with walking cycles, backpacks, graduation mortarboards, snapbacks, and glowing ballot cards.
 * - Flocking and wandering physics across the campus quad with social chat clusters.
 * - Interactive mouse physics: students part ways or turn curiously toward the cursor.
 * - Click celebration: ripple shockwave causes nearby students to jump, cheer ("\\o/"), raise glowing ballots, and display celebratory speech bubbles.
 * - Colorful micro-confetti particle bursts.
 * - Crisp floating hover card revealing individual student voter credentials (Matric, Faculty, Level, Verification Status).
 * - High-DPI Retina scaling, 60 FPS requestAnimationFrame with auto-pause on document hidden.
 */

interface Student {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  facing: number; // 1 = right, -1 = left
  walkCycle: number;
  
  // Student Persona
  name: string;
  department: string;
  level: string;
  badge: string;
  facultyColor: string;
  skinTone: string;
  pantsColor: string;
  headgear: "mortarboard" | "snapback" | "afro" | "scarf" | "none";
  headgearColor: string;
  hasBackpack: boolean;
  backpackColor: string;
  hasBallot: boolean;

  // Dynamic States
  isChatting: boolean;
  chatTimer: number;
  chatPartnerId: number | null;
  cheerProgress: number; // 0 to 1 (1 = fully jumping/cheering)
  cheerBubble: string | null;
  cheerBubbleTimer: number;
  hovered: boolean;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  size: number;
  color: string;
  opacity: number;
  life: number;
  maxLife: number;
}

interface ClickRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
}

const NIGERIAN_FIRST_NAMES = [
  "Fatima", "Adebayo", "Chinedu", "Blessing", "Ibrahim", "Ngozi", 
  "Tunde", "Amina", "Emeka", "Yetunde", "Farouk", "Damilola", 
  "Chidinma", "Kelechi", "Folake", "Osas", "Babatunde", "Maryam", 
  "Segun", "Halima", "Zainab", "Obinna", "Eniola", "Sadiq", "Temitope"
];

const LAST_INITIALS = ["A.", "B.", "C.", "D.", "E.", "K.", "M.", "N.", "O.", "S.", "T.", "U.", "Y.", "Z."];

const FACULTY_PRESETS = [
  { dept: "Computer Science", facultyColor: "#2563eb", badge: "Verified Voter" }, // Royal Blue
  { dept: "Mechanical Eng", facultyColor: "#0284c7", badge: "ELCOM Accredited" }, // Cyan-Blue
  { dept: "Economics", facultyColor: "#d97706", badge: "Dues Cleared" }, // Amber Gold
  { dept: "Law & Jurisprudence", facultyColor: "#7c3aed", badge: "Ballot Issued" }, // Royal Violet
  { dept: "Medicine & Surgery", facultyColor: "#e11d48", badge: "Verified Voter" }, // Crimson
  { dept: "Microbiology", facultyColor: "#059669", badge: "Verified Voter" }, // Emerald Green
  { dept: "Pharmacy", facultyColor: "#0d9488", badge: "ELCOM Accredited" }, // Teal
  { dept: "Accounting", facultyColor: "#b45309", badge: "Dues Cleared" }, // Bronze Gold
  { dept: "Political Science", facultyColor: "#475569", badge: "Ballot Issued" }, // Slate
  { dept: "Electrical Eng", facultyColor: "#3b82f6", badge: "Verified Voter" }, // Blue
];

const SKIN_TONES = ["#3c2014", "#4a2a1a", "#5a3420", "#6d4128", "#784b30", "#875638"];
const PANTS_COLORS = ["#1e293b", "#0f172a", "#334155", "#1e1b4b", "#18181b"];
const CHEER_BUBBLES = ["🗳️ Voted!", "⚡ Verified", "✅ Counted!", "🎓 SUG '26", "🇳🇬 Democracy", "🔒 1-Person-1-Vote", "🎉 100% Legit!"];

export function ElectorateSwarm() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{
    name: string;
    level: string;
    dept: string;
    badge: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let students: Student[] = [];
    let confetti: ConfettiParticle[] = [];
    let ripples: ClickRipple[] = [];

    let width = 0;
    let height = 0;
    let dpr = 1;

    let mouseX = -1000;
    let mouseY = -1000;
    let lastMouseMoveTime = 0;

    // Helper: Initialize Students
    const initStudents = (w: number, h: number) => {
      const count = Math.min(Math.max(Math.floor(w / 28), 35), 65);
      const list: Student[] = [];

      for (let i = 0; i < count; i++) {
        const faculty = FACULTY_PRESETS[i % FACULTY_PRESETS.length];
        const firstName = NIGERIAN_FIRST_NAMES[i % NIGERIAN_FIRST_NAMES.length];
        const lastInitial = LAST_INITIALS[(i * 3 + 7) % LAST_INITIALS.length];
        const levelNum = ((i % 5) + 1) * 100;
        const skin = SKIN_TONES[i % SKIN_TONES.length];
        const pants = PANTS_COLORS[i % PANTS_COLORS.length];

        const headgearTypes: Array<"mortarboard" | "snapback" | "afro" | "scarf" | "none"> = [
          "mortarboard", "snapback", "afro", "scarf", "none", "mortarboard"
        ];
        const headgear = headgearTypes[i % headgearTypes.length];

        const speed = 0.45 + Math.random() * 0.55;
        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * (speed * 0.35); // Students mainly walk horizontally

        // Distribute across hero quad (keeping clear of top edge and sticking to walking ground)
        const x = Math.random() * (w - 80) + 40;
        const y = h * 0.22 + Math.random() * (h * 0.72);

        list.push({
          id: i,
          x,
          y,
          vx,
          vy,
          speed,
          facing: vx >= 0 ? 1 : -1,
          walkCycle: Math.random() * Math.PI * 2,
          name: `${firstName} ${lastInitial}`,
          department: faculty.dept,
          level: `${levelNum}L`,
          badge: faculty.badge,
          facultyColor: faculty.facultyColor,
          skinTone: skin,
          pantsColor: pants,
          headgear,
          headgearColor: headgear === "snapback" ? (i % 2 === 0 ? "#dc2626" : "#2563eb") : "#1e293b",
          hasBackpack: i % 2 === 0,
          backpackColor: i % 3 === 0 ? "#78350f" : "#374151",
          hasBallot: true,
          isChatting: false,
          chatTimer: 0,
          chatPartnerId: null,
          cheerProgress: 0,
          cheerBubble: null,
          cheerBubbleTimer: 0,
          hovered: false,
        });
      }

      return list;
    };

    const handleResize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      if (students.length === 0) {
        students = initStudents(width, height);
      } else {
        // Clamp existing students
        students.forEach((s) => {
          s.x = Math.max(20, Math.min(width - 20, s.x));
          s.y = Math.max(height * 0.18, Math.min(height * 0.94, s.y));
        });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Mouse Tracking
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      lastMouseMoveTime = performance.now();
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
      setActiveTooltip(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    // Click Celebration Trigger
    const triggerCelebration = (clickX: number, clickY: number) => {
      // 1. Add Ripple Wave
      ripples.push({
        x: clickX,
        y: clickY,
        radius: 5,
        maxRadius: Math.max(240, width * 0.45),
        opacity: 0.85,
      });

      // 2. Confetti Particle Explosion
      const colors = ["#2563eb", "#059669", "#7c3aed", "#d97706", "#e11d48", "#10b981", "#f59e0b"];
      for (let i = 0; i < 35; i++) {
        const angle = Math.random() * Math.PI * 2;
        const force = 2.5 + Math.random() * 5.5;
        confetti.push({
          x: clickX,
          y: clickY,
          vx: Math.cos(angle) * force,
          vy: Math.sin(angle) * force - 3.2, // Launch upwards
          rotation: Math.random() * Math.PI,
          vRot: (Math.random() - 0.5) * 0.25,
          size: 3.5 + Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: 1,
          life: 0,
          maxLife: 60 + Math.random() * 40,
        });
      }

      // 3. Make Nearby Students Cheer & Jump!
      students.forEach((s) => {
        const dist = Math.hypot(s.x - clickX, s.y - clickY);
        if (dist < 320) {
          // Delay jump slightly based on distance for ripple propagation effect
          const delayMs = dist * 1.2;
          setTimeout(() => {
            s.cheerProgress = 1.0;
            s.cheerBubble = CHEER_BUBBLES[Math.floor(Math.random() * CHEER_BUBBLES.length)];
            s.cheerBubbleTimer = 75; // ~1.2s at 60fps
            // Face the click point
            s.facing = clickX >= s.x ? 1 : -1;
          }, delayMs);
        }
      });
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Only trigger if click was inside or near the hero canvas
      if (clickX >= 0 && clickX <= width && clickY >= 0 && clickY <= height) {
        triggerCelebration(clickX, clickY);
      }
    };

    window.addEventListener("click", handleClick);

    // =========================================================================
    // RENDER & UPDATE LOOP
    // =========================================================================
    const render = () => {
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Sort students by Y position (depth sorting) so closer students render in front
      students.sort((a, b) => a.y - b.y);

      let foundHoveredStudent: Student | null = null;

      // Update and Draw Students
      students.forEach((s) => {
        // --- 1. Physics & Movement ---
        if (s.cheerProgress > 0) {
          s.cheerProgress = Math.max(0, s.cheerProgress - 0.028);
        }

        if (s.cheerBubbleTimer > 0) {
          s.cheerBubbleTimer--;
          if (s.cheerBubbleTimer <= 0) s.cheerBubble = null;
        }

        // Distance to cursor
        const distToMouse = Math.hypot(s.x - mouseX, s.y - mouseY);
        const isNearMouse = distToMouse < 90;
        const isHovered = distToMouse < 26;

        if (isHovered && !foundHoveredStudent) {
          foundHoveredStudent = s;
          s.hovered = true;
        } else {
          s.hovered = false;
        }

        // Mouse Evasion / Curiosity
        if (isNearMouse && mouseX > 0 && mouseY > 0) {
          const moveSpeed = performance.now() - lastMouseMoveTime;
          if (moveSpeed < 100) {
            // Mouse moving fast: gently part ways
            const angle = Math.atan2(s.y - mouseY, s.x - mouseX);
            s.vx += Math.cos(angle) * 0.12;
            s.vy += Math.sin(angle) * 0.08;
          } else {
            // Mouse hovering gently: turn curiously toward cursor
            s.facing = mouseX > s.x ? 1 : -1;
            s.vx *= 0.88;
            s.vy *= 0.88;
          }
        } else {
          // Normal Stroll & Social Chatting
          if (s.isChatting) {
            s.chatTimer--;
            s.vx *= 0.7;
            s.vy *= 0.7;
            if (s.chatTimer <= 0) {
              s.isChatting = false;
              s.chatPartnerId = null;
              // resume walking
              const angle = (Math.random() - 0.5) * Math.PI;
              s.vx = (s.facing > 0 ? 1 : -1) * (0.4 + Math.random() * 0.5);
              s.vy = Math.sin(angle) * 0.15;
            }
          } else {
            // Random chance to start chatting with nearby peer
            if (Math.random() < 0.002 && !s.cheerProgress) {
              const peer = students.find(
                (other) =>
                  other.id !== s.id &&
                  !other.isChatting &&
                  Math.hypot(s.x - other.x, s.y - other.y) < 38
              );
              if (peer) {
                s.isChatting = true;
                s.chatTimer = 180 + Math.floor(Math.random() * 120);
                s.chatPartnerId = peer.id;
                peer.isChatting = true;
                peer.chatTimer = s.chatTimer;
                peer.chatPartnerId = s.id;
                // Face each other
                s.facing = peer.x > s.x ? 1 : -1;
                peer.facing = s.x > peer.x ? 1 : -1;
              }
            }

            // Normal stroll
            s.x += s.vx;
            s.y += s.vy;

            // Speed clamping
            const currentSpeed = Math.hypot(s.vx, s.vy);
            if (currentSpeed > 1.2) {
              s.vx *= 0.94;
              s.vy *= 0.94;
            } else if (currentSpeed < 0.35 && !s.isChatting) {
              s.vx += (s.facing > 0 ? 0.05 : -0.05);
            }

            // Boundary rebounds (Campus perimeter)
            const minX = 24;
            const maxX = width - 24;
            const minY = height * 0.2;
            const maxY = height * 0.92;

            if (s.x < minX) {
              s.x = minX;
              s.vx = Math.abs(s.vx) || 0.5;
              s.facing = 1;
            } else if (s.x > maxX) {
              s.x = maxX;
              s.vx = -Math.abs(s.vx) || -0.5;
              s.facing = -1;
            }

            if (s.y < minY) {
              s.y = minY;
              s.vy = Math.abs(s.vy) || 0.2;
            } else if (s.y > maxY) {
              s.y = maxY;
              s.vy = -Math.abs(s.vy) || -0.2;
            }

            if (Math.abs(s.vx) > 0.15) {
              s.facing = s.vx > 0 ? 1 : -1;
            }
          }
        }

        // Animate walk gait
        const isMoving = Math.hypot(s.vx, s.vy) > 0.15;
        if (isMoving && !s.isChatting) {
          s.walkCycle += 0.18;
        }

        // --- 2. Avatar Drawing ---
        ctx.save();

        const x = s.x;
        const y = s.y;
        const dir = s.facing;
        const jumpY = -Math.sin(s.cheerProgress * Math.PI) * 16;
        const bob = isMoving ? Math.abs(Math.sin(s.walkCycle * 2)) * 1.3 : 0;
        const legSwing = isMoving ? Math.sin(s.walkCycle) : 0;

        // Ground shadow
        const shadowScale = Math.max(0.4, 1 - Math.abs(jumpY) / 24);
        ctx.fillStyle = "rgba(15, 23, 42, 0.14)";
        ctx.beginPath();
        ctx.ellipse(x, y, 6 * shadowScale, 2.2 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        ctx.lineWidth = 1.7;
        ctx.lineCap = "round";
        ctx.strokeStyle = s.pantsColor;

        // Back leg
        ctx.beginPath();
        ctx.moveTo(x - dir * 1.2, y - 5 + jumpY);
        ctx.lineTo(x - dir * 1.2 - legSwing * 2.8, y + jumpY);
        ctx.stroke();

        // Front leg
        ctx.beginPath();
        ctx.moveTo(x + dir * 1.2, y - 5 + jumpY);
        ctx.lineTo(x + dir * 1.2 + legSwing * 2.8, y + jumpY);
        ctx.stroke();

        // Torso / Faculty Polo
        const torsoTopY = y - 12 + jumpY - bob;
        ctx.fillStyle = s.facultyColor;
        ctx.beginPath();
        // Rounded torso capsule
        ctx.roundRect(x - 2.5, torsoTopY, 5, 7.5, [2, 2, 1, 1]);
        ctx.fill();

        // Backpack (if worn)
        if (s.hasBackpack) {
          ctx.fillStyle = s.backpackColor;
          ctx.beginPath();
          ctx.roundRect(x - dir * 3.8, torsoTopY + 1.2, 2.4, 5.2, 1.2);
          ctx.fill();
        }

        // Arms & Ballot Token
        const shoulderY = torsoTopY + 1.8;
        ctx.strokeStyle = s.facultyColor;
        ctx.lineWidth = 1.6;

        if (s.cheerProgress > 0.05 || s.hovered) {
          // Cheering celebration or waving! (Raised arms "\o/")
          ctx.beginPath();
          ctx.moveTo(x - 2.5, shoulderY);
          ctx.lineTo(x - 5.5, shoulderY - 7.5);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x + 2.5, shoulderY);
          ctx.lineTo(x + 5.5, shoulderY - 7.5);
          ctx.stroke();

          // Held Ballot Card (Glowing Emerald/Cyan token)
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "#10b981";
          ctx.shadowBlur = 6;
          ctx.fillRect(x + dir * 4.5, shoulderY - 11, 4.5, 3.5);
          ctx.shadowBlur = 0;

          // Tiny green check on card
          ctx.fillStyle = "#059669";
          ctx.fillRect(x + dir * 4.5 + 1.2, shoulderY - 9.8, 2, 1.4);
        } else if (s.isChatting) {
          // Gesturing / Chatting arms
          const armGesture = Math.sin(performance.now() * 0.008 + s.id) * 2;
          ctx.beginPath();
          ctx.moveTo(x - 2, shoulderY);
          ctx.lineTo(x + dir * 3.5, shoulderY + 1.5 + armGesture);
          ctx.stroke();
        } else {
          // Standard walking arm swing
          ctx.beginPath();
          ctx.moveTo(x - dir * 1.5, shoulderY);
          ctx.lineTo(x - dir * 1.5 + legSwing * 2, shoulderY + 4.5);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x + dir * 1.5, shoulderY);
          ctx.lineTo(x + dir * 1.5 - legSwing * 2, shoulderY + 4.5);
          ctx.stroke();

          // Held Ballot Token at side
          if (s.hasBallot) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x + dir * 2.8, shoulderY + 2.5, 3, 2.2);
            ctx.fillStyle = "#10b981";
            ctx.fillRect(x + dir * 2.8 + 0.8, shoulderY + 3.2, 1.4, 0.9);
          }
        }

        // Head
        const headY = torsoTopY - 3.2;
        ctx.fillStyle = s.skinTone;
        ctx.beginPath();
        ctx.arc(x, headY, 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Eye (facing direction)
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.arc(x + dir * 1.4, headY - 0.2, 0.65, 0, Math.PI * 2);
        ctx.fill();

        // Headgear
        if (s.headgear === "mortarboard") {
          // Graduation Cap (Diamond mortarboard)
          ctx.fillStyle = "#0f172a";
          ctx.beginPath();
          ctx.moveTo(x, headY - 4.8);
          ctx.lineTo(x + 5.2, headY - 3.4);
          ctx.lineTo(x, headY - 2.0);
          ctx.lineTo(x - 5.2, headY - 3.4);
          ctx.closePath();
          ctx.fill();

          // Gold Tassel
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, headY - 3.4);
          ctx.lineTo(x - dir * 3.8, headY - 1.2);
          ctx.stroke();
        } else if (s.headgear === "snapback") {
          // Baseball cap with visor
          ctx.fillStyle = s.headgearColor;
          ctx.beginPath();
          ctx.arc(x, headY - 1.2, 2.9, Math.PI, Math.PI * 2);
          ctx.fill();
          // Visor
          ctx.beginPath();
          ctx.moveTo(x, headY - 1.2);
          ctx.lineTo(x + dir * 4.2, headY - 0.8);
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = s.headgearColor;
          ctx.stroke();
        } else if (s.headgear === "afro") {
          // Puffed natural afro hair
          ctx.fillStyle = "#18181b";
          ctx.beginPath();
          ctx.arc(x - dir * 0.5, headY - 1.4, 3.4, 0, Math.PI * 2);
          ctx.fill();
          // Re-draw skin face peek
          ctx.fillStyle = s.skinTone;
          ctx.beginPath();
          ctx.arc(x + dir * 0.8, headY, 2.3, 0, Math.PI * 2);
          ctx.fill();
          // Re-draw eye
          ctx.fillStyle = "#1e293b";
          ctx.beginPath();
          ctx.arc(x + dir * 1.4, headY - 0.2, 0.65, 0, Math.PI * 2);
          ctx.fill();
        }

        // Floating Cheer Speech Bubble
        if (s.cheerBubble) {
          const bubbleY = headY - 16;
          ctx.font = "bold 9px ui-sans-serif, system-ui, -apple-system, sans-serif";
          const textMetrics = ctx.measureText(s.cheerBubble);
          const bubbleW = textMetrics.width + 10;
          const bubbleH = 15;

          // Bubble background
          ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
          ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.roundRect(x - bubbleW / 2, bubbleY - bubbleH / 2, bubbleW, bubbleH, 6);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Downward pointer
          ctx.beginPath();
          ctx.moveTo(x - 2.5, bubbleY + bubbleH / 2);
          ctx.lineTo(x + 2.5, bubbleY + bubbleH / 2);
          ctx.lineTo(x, bubbleY + bubbleH / 2 + 3);
          ctx.closePath();
          ctx.fill();

          // Bubble text
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(s.cheerBubble, x, bubbleY);
        }

        ctx.restore();
      });

      // Update Tooltip State for React UI
      if (foundHoveredStudent) {
        const s: Student = foundHoveredStudent;
        setActiveTooltip({
          name: s.name,
          level: s.level,
          dept: s.department,
          badge: s.badge,
          x: s.x,
          y: s.y - 32,
        });
      } else {
        setActiveTooltip(null);
      }

      // --- 3. Render Click Ripples ---
      ripples.forEach((r, idx) => {
        r.radius += 6.5;
        r.opacity = Math.max(0, 1 - r.radius / r.maxRadius);

        ctx.save();
        ctx.strokeStyle = `rgba(16, 185, 129, ${r.opacity * 0.6})`;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner glowing pulse
        ctx.strokeStyle = `rgba(59, 130, 246, ${r.opacity * 0.4})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(r.x, r.y, Math.max(0, r.radius - 12), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        if (r.radius >= r.maxRadius) {
          ripples.splice(idx, 1);
        }
      });

      // --- 4. Render Confetti Particles ---
      confetti.forEach((c, idx) => {
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.12; // Gravity
        c.vx *= 0.98; // Air resistance
        c.rotation += c.vRot;
        c.life++;

        c.opacity = Math.max(0, 1 - c.life / c.maxLife);

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        ctx.fillStyle = c.color;
        ctx.globalAlpha = c.opacity;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 1.4);
        ctx.restore();

        if (c.life >= c.maxLife) {
          confetti.splice(idx, 1);
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden"
    >
      {/* Interactive Canvas - pointer-events-none ensures hero CTAs & links are never blocked */}
      <canvas
        ref={canvasRef}
        className="w-full h-full pointer-events-none"
      />

      {/* Floating Hover Card for Student Credential Inspection */}
      {activeTooltip && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none transition-all duration-150 z-30"
          style={{
            left: `${activeTooltip.x}px`,
            top: `${activeTooltip.y}px`,
          }}
        >
          <div className="bg-zinc-900/95 backdrop-blur-md text-white rounded-xl px-3 py-2 border border-zinc-700/80 shadow-2xl space-y-1 text-left min-w-[170px]">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1">
              <span className="font-bold text-xs text-white flex items-center gap-1">
                <span>🎓 {activeTooltip.name}</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400 font-bold">
                {activeTooltip.level}
              </span>
            </div>
            <div className="text-[11px] text-zinc-300 font-medium">
              {activeTooltip.dept}
            </div>
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                {activeTooltip.badge}
              </span>
            </div>
          </div>
          {/* Tooltip triangle */}
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-zinc-900/95 mx-auto" />
        </div>
      )}
    </div>
  );
}
