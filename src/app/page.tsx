import { WallApp } from "@/components/WallApp";
import { gymWall } from "@/data/gymWall";
import { samplePhotos } from "@/data/samples";
import { validateWall } from "@/lib/sequence";

export default function Page() {
  // Runs on the server during `next build`, so invalid data fails the build.
  const errors = validateWall(gymWall);
  if (errors.length > 0) {
    throw new Error(`Invalid wall data:\n${errors.join("\n")}`);
  }
  return (
    <main>
      <WallApp initialWall={gymWall} samples={samplePhotos} />
    </main>
  );
}
