// src/components/Logo.tsx
import React from 'react';

interface LogoProps {
    className?: string;
}

export default function Logo({ className = "w-8 h-8" }: LogoProps) {
    return (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Dark monochrome background tile */}
            <rect width="32" height="32" rx="8" fill="#0a0a0a" className="stroke-[#222]" strokeWidth="1" />

            {/* The subtle blue "Play" triangle glowing in the background */}
            <path
                d="M11 8L23 16L11 24V8Z"
                fill="#2563eb"
                opacity="0.8"
                className="drop-shadow-[0_0_8px_rgba(37,99,235,0.8)]"
            />

            {/* The sharp, minimalist "K" overlaid on top */}
            <path
                d="M11 8V24"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            <path
                d="M11 16L20 8M11 16L20 24"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}