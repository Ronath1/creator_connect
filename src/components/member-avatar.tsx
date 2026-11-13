"use client";
import Image from "next/image";
import { useState } from "react";
export function MemberAvatar({ id, name }: { id: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div
      className="member-avatar-fallback"
      aria-label={`${name}: no profile image`}
    >
      {name.slice(0, 1)}
    </div>
  ) : (
    <Image
      className="member-avatar"
      src={`/api/profile-image?member=${encodeURIComponent(id)}`}
      alt={`${name} profile image`}
      width={96}
      height={96}
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
