import HeroSection, { type PublicAcademyProfile } from "@/components/landing/HeroSection";

export const dynamic = "force-dynamic";

async function getPublicAcademyProfile(): Promise<PublicAcademyProfile | null> {
  const apiUrl = (
    process.env.GOALIX_INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");

  try {
    const response = await fetch(`${apiUrl}/api/v1/academy/public-profile`, {
      cache: "no-store",
    });

    if (!response.ok) return null;

    const json = (await response.json()) as { data?: PublicAcademyProfile };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const publicProfile = await getPublicAcademyProfile();

  return <HeroSection initialPublicProfile={publicProfile} />;
}
