// src/components/ui/RollIcon.tsx
// أيقونة "التوب": أسطوانة قماش وطرفها مفرود — بنفس أسلوب أيقونات lucide (خط 2px وأطراف مدورة).
import type { SVGProps } from "react";

export function RollIcon({ size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <ellipse cx="7" cy="8.5" rx="3.5" ry="5" />
      <ellipse cx="7" cy="8.5" rx="1" ry="1.6" />
      <path d="M7 3.5h10c1.9 0 3.5 2.2 3.5 5s-1.6 5-3.5 5" />
      <path d="M7 13.5h4v7l2-1.5 2 1.5v-7h2" />
    </svg>
  );
}
