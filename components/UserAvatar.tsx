"use client";

import { useState } from "react";

interface UserAvatarProps {
  src?: string | null;
  name: string;
  sizeClass?: string;
  textClass?: string;
}

function AvatarImage({
  src,
  name,
  sizeClass,
  textClass,
}: {
  src: string;
  name: string;
  sizeClass: string;
  textClass: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-teal-700 font-bold uppercase text-white ${sizeClass} ${textClass}`}
      >
        {name.slice(0, 1) || "U"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full border border-slate-200 object-cover ${sizeClass}`}
    />
  );
}

/**
 * Renders a Google profile photo with `no-referrer` (prevents lh3.googleusercontent.com 403)
 * and falls back cleanly to a letter avatar if missing or blocked.
 */
export default function UserAvatar({
  src,
  name,
  sizeClass = "h-7 w-7",
  textClass = "text-xs",
}: UserAvatarProps) {
  if (src) {
    return (
      <AvatarImage
        key={src}
        src={src}
        name={name}
        sizeClass={sizeClass}
        textClass={textClass}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-teal-700 font-bold uppercase text-white ${sizeClass} ${textClass}`}
    >
      {name.slice(0, 1) || "U"}
    </span>
  );
}
