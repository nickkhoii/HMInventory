import Image from "next/image";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/hm-logo.png"
      alt="College of Hospitality Management, Cordova Public College"
      width={160}
      height={160}
      loading="eager"
      className={`brand-logo ${className}`}
    />
  );
}
