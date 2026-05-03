"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function TanStack({ className }: { className?: string }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      className={cn(
        "relative flex items-center justify-center size-14 bg-black rounded-full border border-neutral-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer overflow-hidden",
        className
      )}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      whileTap={{ scale: 0.95 }}
      aria-label="TanStack Logo"
    >
      <Logo 
        isHovered={isHovered} 
        className="w-10 h-10 transition-transform duration-300" 
      />
    </motion.button>
  );
}

// Deconstruct the complex SVG to animate pieces
const Logo = ({ className, isHovered }: { className?: string; isHovered: boolean }) => {
  return (
    <motion.svg 
      xmlns="http://www.w3.org/2000/svg" 
      xmlnsXlink="http://www.w3.org/1999/xlink" 
      viewBox="0 0 633 633"
      className={cn(className)}
      initial="hidden"
      animate={isHovered ? "hover" : "visible"}
    >
      <defs>
        <linearGradient id="tanstack__b" x1="50%" x2="50%" y1="0%" y2="71.65%">
          <stop offset="0%" stopColor="#6BDAFF" />
          <stop offset="31.922%" stopColor="#F9FFB5" />
          <stop offset="70.627%" stopColor="#FFA770" />
          <stop offset="100%" stopColor="#FF7373" />
        </linearGradient>
        <linearGradient id="tanstack__d" x1="43.996%" x2="53.441%" y1="8.54%" y2="93.872%">
          <stop offset="0%" stopColor="#673800" />
          <stop offset="100%" stopColor="#B65E00" />
        </linearGradient>
        <linearGradient id="tanstack__e" x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#2F8A00" />
          <stop offset="100%" stopColor="#90FF57" />
        </linearGradient>
        <linearGradient id="tanstack__k" x1="92.9%" x2="8.641%" y1="45.768%" y2="54.892%">
          <stop offset="0%" stopColor="#EE2700" />
          <stop offset="100%" stopColor="#FF008E" />
        </linearGradient>
        <linearGradient id="tanstack__l" x1="61.109%" x2="43.717%" y1="3.633%" y2="43.072%">
          <stop offset="0%" stopColor="#FFF400" />
          <stop offset="100%" stopColor="#3C8700" />
        </linearGradient>
        <linearGradient id="tanstack__m" x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#FFDF00" />
          <stop offset="100%" stopColor="#FF9D00" />
        </linearGradient>
        <circle id="tanstack__a" cx="308.5" cy="308.5" r="308.5" />
      </defs>
      
      <g fill="none" fillRule="evenodd" transform="translate(9 8)">
        <mask id="tanstack__c" fill="#fff">
          <use xlinkHref="#tanstack__a" />
        </mask>

        {/* Base Background Circle */}
        <motion.use 
          xlinkHref="#tanstack__a" 
          fill="url(#tanstack__b)"
          variants={{
            hidden: { scale: 0, opacity: 0 },
            visible: { scale: 1, opacity: 1, transition: { duration: 0.6, ease: "backOut" } },
            hover: { scale: 1, opacity: 1 }
          }}
          style={{ originX: "50%", originY: "50%" }}
        />

        {/* Blue Ellipses (Water/Waves) */}
        {[
          { cx: 81.5, cy: 602.5, stroke: "#00CFE2", delay: 0.1 },
          { cx: 535.5, cy: 602.5, stroke: "#00CFE2", delay: 0.15 },
          { cx: 81.5, cy: 640.5, stroke: "#00A8B8", delay: 0.2 },
          { cx: 535.5, cy: 640.5, stroke: "#00A8B8", delay: 0.25 },
          { cx: 81.5, cy: 676.5, stroke: "#007782", delay: 0.3 },
          { cx: 535.5, cy: 676.5, stroke: "#007782", delay: 0.35 },
        ].map((ellipse, i) => (
          <motion.ellipse 
            key={`wave-${i}`}
            cx={ellipse.cx} 
            cy={ellipse.cy} 
            fill="#015064" 
            stroke={ellipse.stroke} 
            strokeWidth="25" 
            mask="url(#tanstack__c)" 
            rx="214.5" 
            ry="185.968"
            variants={{
              hidden: { y: 200, opacity: 0 },
              visible: { y: 0, opacity: 1, transition: { duration: 0.8, ease: "backOut", delay: ellipse.delay } },
              hover: { 
                y: [0, -15, 0], 
                transition: { repeat: Infinity, duration: 2, ease: "easeInOut", delay: i * 0.2 } 
              }
            }}
          />
        ))}

        <g mask="url(#tanstack__c)">
          {/* Mountain/Land base */}
          <motion.path 
            fill="url(#tanstack__d)" 
            stroke="#6E3A00" 
            strokeWidth="6.088" 
            d="M98.318 88.007c7.691 37.104 16.643 72.442 26.856 106.013 10.212 33.571 25.57 68.934 46.07 106.088l-51.903 11.67c-10.057-60.01-17.232-99.172-21.525-117.487-4.293-18.315-10.989-51.434-20.089-99.357l20.591-6.927" 
            transform="scale(-1 1) rotate(25 -300.37 -553.013)"
            variants={{
              hidden: { scale: 0.5, y: 100, opacity: 0 },
              visible: { scale: 1, y: 0, opacity: 1, transition: { duration: 0.6, ease: "backOut", delay: 0.2 } },
              hover: { scale: 1.05, y: -5, transition: { duration: 0.4, ease: "easeOut" } }
            }}
          />

          {/* Greenery/Trees */}
          <motion.g 
            stroke="#2F8A00"
            variants={{
              hidden: { scale: 0.8, opacity: 0 },
              visible: { scale: 1, opacity: 1, transition: { duration: 0.6, delay: 0.3 } },
              hover: { scale: 1.05, transition: { duration: 0.4, ease: "easeOut", delay: 0.05 } }
            }}
          >
            {/* Keeping just a few core paths from the massive group to represent the tree for performance and clarity */}
            <path fill="url(#tanstack__e)" strokeWidth="9.343" d="M108.544 66.538s-13.54-21.305-37.417-27.785c-15.917-4.321-33.933.31-54.048 13.892C33.464 65.975 47.24 73.52 58.405 75.28c16.749 2.64 50.14-8.74 50.14-8.74Z" transform="rotate(1 -6061.691 5926.397)"/>
            <path fill="url(#tanstack__e)" strokeWidth="9.343" d="M108.544 67.138s-47.187-5.997-81.077 19.936C4.873 104.362-3.782 137.794 1.502 187.369c28.42-29.22 48.758-50.836 61.016-64.846 18.387-21.016 46.026-55.385 46.026-55.385Z" transform="rotate(1 -6061.691 5926.397)"/>
            <path fill="url(#tanstack__e)" strokeWidth="9.343" d="M108.544 66.538c-1.96-21.705 3.98-38.018 17.82-48.94C140.203 6.674 154.85.808 170.303 0c-4.865 21.527-12.373 36.314-22.524 44.361-10.151 8.048-23.23 15.44-39.236 22.177Z" transform="rotate(1 -6061.691 5926.397)"/>
            <path fill="url(#tanstack__e)" strokeWidth="9.343" d="M108.544 67.138c29.838-31.486 61.061-42.776 93.669-33.869C234.82 42.176 253.749 60.785 259 89.096c-34.898-3.657-59.974-6.343-75.228-8.058-15.254-1.716-40.33-6.349-75.228-13.9Z" transform="rotate(1 -6061.691 5926.397)"/>
            <path fill="url(#tanstack__e)" strokeWidth="9.343" d="M108.544 67.138c34.868-9.381 64.503-3.658 88.905 17.17 24.402 20.829 39.656 46.686 45.762 77.571-39.626-7.574-68.4-20.115-86.322-37.624a395.051 395.051 0 0 1-48.345-57.117Z" transform="rotate(1 -6061.691 5926.397)"/>
            <path fill="url(#tanstack__e)" strokeWidth="9.343" d="M108.544 67.138C76.206 82.6 57.608 105.366 52.75 135.436c-4.858 30.07-.292 62.89 13.698 98.462 24.873-41.418 38.905-71.368 42.096-89.849 3.191-18.48 3.191-44.118 0-76.91Z" transform="rotate(1 -6061.691 5926.397)"/>
            <path strokeLinecap="round" strokeWidth="5.91" d="M211.284 173.477c-13.851 21.992-23.291 42.022-28.32 60.093-5.03 18.071-8.175 33.143-9.436 45.216"/>
            <path strokeLinecap="round" strokeWidth="5.91" d="M209.814 176.884c-23.982 2.565-42.792 10.469-56.428 23.714-13.639 13.245-23.483 26.136-29.536 38.674M219.045 167.299c29.028-7.723 50.972-10.173 65.831-7.352 14.859 2.822 26.807 7.659 35.842 14.51M211.31 172.618c20.29 9.106 38.353 19.052 54.186 29.837 15.833 10.786 27.714 20.99 35.643 30.617"/>
          </motion.g>

          {/* Red Flag */}
          <motion.path 
            fill="url(#tanstack__k)" 
            d="M67.585 27.463H5.68C1.893 28.148 0 30.38 0 34.16c0 3.78 1.893 6.211 5.68 7.293h67.17l41.751-30.356c2.488-2.646 2.794-5.315.92-8.006s-4.6-3.626-8.177-2.803l-39.76 27.174Z" 
            transform="scale(-1 1) rotate(-9 2092.128 2856.854)"
            variants={{
              hidden: { scale: 0, opacity: 0 },
              visible: { scale: 1, opacity: 1, transition: { duration: 0.5, delay: 0.5, ease: "backOut" } },
              hover: { rotate: [-5, 5, -5], transition: { repeat: Infinity, duration: 1 } }
            }}
            style={{ originX: "100%", originY: "100%" }}
          />
          
        </g>

        {/* Foreground Greens */}
        <motion.ellipse 
          cx="308.5" cy="720.5" fill="url(#tanstack__l)" mask="url(#tanstack__c)" rx="266" ry="316.5"
          variants={{
            hidden: { y: 200, opacity: 0 },
            visible: { y: 0, opacity: 1, transition: { duration: 0.7, delay: 0.4, ease: "easeOut" } },
            hover: { y: -10, transition: { duration: 0.5 } }
          }}
        />

        {/* Sun */}
        <motion.g mask="url(#tanstack__c)">
          <motion.g 
            transform="translate(389 -32)"
            variants={{
              hidden: { y: 150, opacity: 0, scale: 0.8 },
              visible: { y: 0, opacity: 1, scale: 1, transition: { duration: 1, delay: 0.3, ease: "easeOut" } },
              hover: { rotate: 45, scale: 1.1, transition: { duration: 2, ease: "linear", repeat: Infinity } }
            }}
            style={{ originX: "168px", originY: "113px" }}
          >
            <circle cx="168.5" cy="113.5" r="113.5" fill="url(#tanstack__m)" />
            <circle cx="168.5" cy="113.5" r="106" stroke="#FFC900" strokeOpacity=".529" strokeWidth="15" />
            <path stroke="#FFA400" strokeLinecap="round" strokeLinejoin="bevel" strokeWidth="12" d="M30 113H0" />
            <path stroke="#FFA400" strokeLinecap="round" strokeLinejoin="bevel" strokeWidth="12" d="M33.5 79.5 7 74" />
            <path stroke="#FFA400" strokeLinecap="round" strokeLinejoin="bevel" strokeWidth="12" d="m34 146-29 8" />
            <path stroke="#FFA400" strokeLinecap="round" strokeLinejoin="bevel" strokeWidth="12" d="m45 177-24 13" />
            <path stroke="#FFA400" strokeLinecap="round" strokeLinejoin="bevel" strokeWidth="12" d="m67 204-20 19" />
            <path stroke="#FFA400" strokeLinecap="round" strokeLinejoin="bevel" strokeWidth="12" d="m94.373 227-13.834 22.847" />
            <path stroke="#FFA400" strokeLinecap="round" strokeLinejoin="bevel" strokeWidth="12" d="M127.5 243.5 120 268" />
            <path stroke="#FFA400" strokeLinecap="round" strokeLinejoin="bevel" strokeWidth="12" d="m167.5 252.5.5 24.5" />
          </motion.g>
        </motion.g>
        
        {/* Outer Border */}
        <circle cx="307.5" cy="308.5" r="304" stroke="#000" strokeWidth="25" />
      </g>
    </motion.svg>
  );
};
