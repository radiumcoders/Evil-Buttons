"use client"
import React, { useState } from 'react'
import { motion } from 'motion/react'

const HornSvg= ({className}: {className?: string})=>{
    return (
        <svg width="109" height="25" viewBox="0 0 109 90" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
<path d="M3.03185 86.9125L90.1135 84.1034C93.5217 83.9935 94.2609 78.7889 91.0479 77.6469C71.5795 70.7269 42.1955 58.6135 35.3203 46.5C29.2868 35.8695 28.041 22.1022 28.0728 12.3131C28.083 9.16839 23.7337 7.66104 22.0945 10.3448C16.177 20.0327 7.95496 35.0668 4.32007 49C-0.17992 66.2492 -0.180022 78.9989 0.10125 84.2962C0.182932 85.8345 1.49214 86.9622 3.03185 86.9125Z" fill="#DC2627"/>
<path d="M28.2443 51.71C28.9249 50.206 30.6856 49.5252 32.201 50.1801C33.7349 50.843 34.441 52.6238 33.7781 54.1577L22.4095 80.4645C21.2245 83.2066 20.632 84.5776 19.4766 85.3893C18.3212 86.201 16.8304 86.2935 13.849 86.4784L13.5 86.5C13.0313 86.5 12.7191 86.016 12.9123 85.5891L28.2443 51.71Z" fill="white"/>
<path d="M41.7587 71.8909C42.4484 70.2952 44.3011 69.5607 45.8969 70.2503C47.3828 70.8924 48.1395 72.5569 47.6464 74.0987L44.7401 83.186C44.2941 84.5804 43.0362 85.5567 41.5748 85.6427L38.443 85.827C37.1299 85.9042 36.2218 84.5358 36.8032 83.3558L41.7587 71.8909Z" fill="white"/>
</svg>

    )
}

export const DemonicButton  = ({label}:{label:string}) => {
  const [hovered, setHovered] = useState(false)

  const hornVariants = {
    idle: { y: 20, transition: { type: "tween" as const, duration: 0.3, ease: [0.36, 0, 0.66, -0.56] as [number, number, number, number] } },
    hover: { y: -13, transition: { type: "tween" as const, duration: 0.15, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
  }

  return (
    <div
      className="relative w-fit"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
        <motion.div
          className="absolute -left-5 bottom-[60%] w-10 h-auto z-0 "
          variants={hornVariants}
          animate={hovered ? "hover" : "idle"}
          transition={{ type: "tween", duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <HornSvg />
        </motion.div>
        <motion.div
          className="absolute -right-5 bottom-[60%] w-10 h-auto z-0 -scale-x-100"
          variants={hornVariants}
          animate={hovered ? "hover" : "idle"}
          transition={{ type: "tween", duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <HornSvg />
        </motion.div>
        <motion.button
          className="relative z-10 px-6 py-2 min-w-30 focus:outline-none text-white rounded-xl"
          initial={{ backgroundColor: "#000000" }}
          whileTap={{ backgroundColor: "#DC2626" }}
          transition={{ duration: 0.1 }}
        >
            {label}
        </motion.button>
    </div>
  )
}
