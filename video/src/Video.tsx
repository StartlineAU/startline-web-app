import { AbsoluteFill, Sequence } from 'remotion';
import { IntroScene }      from './scenes/Intro';
import { StatsScene }      from './scenes/Stats';
import { DashboardScene }  from './scenes/Dashboard';
import { NewListingScene } from './scenes/NewListing';
import { ReviewScene }     from './scenes/Review';
import { GoLiveScene }     from './scenes/GoLive';
import { CTAScene }        from './scenes/CTA';

// Frames two adjacent scenes overlap — this is the motion-cut window.
// During this window Scene A exits left while Scene B enters from right.
export const OVERLAP = 18;

interface SceneDef {
  Scene: React.FC<{ durationInFrames: number }>;
  duration: number;
}

export const SCENES: SceneDef[] = [
  { Scene: IntroScene,      duration: 120 }, // 4.0 s
  { Scene: StatsScene,      duration: 105 }, // 3.5 s
  { Scene: DashboardScene,  duration: 135 }, // 4.5 s
  { Scene: NewListingScene, duration: 135 }, // 4.5 s
  { Scene: ReviewScene,     duration: 135 }, // 4.5 s
  { Scene: GoLiveScene,     duration: 135 }, // 4.5 s
  { Scene: CTAScene,        duration: 105 }, // 3.5 s
];

// Stagger start times so each scene begins OVERLAP frames before the previous ends
function buildStarts(scenes: SceneDef[], overlap: number): number[] {
  const starts: number[] = [];
  let t = 0;
  for (const s of scenes) {
    starts.push(t);
    t += s.duration - overlap;
  }
  return starts;
}

export const SCENE_STARTS = buildStarts(SCENES, OVERLAP);
export const TOTAL_FRAMES =
  SCENE_STARTS[SCENE_STARTS.length - 1] + SCENES[SCENES.length - 1].duration;

export const StarlineVideo: React.FC = () => (
  <AbsoluteFill>
    {SCENES.map(({ Scene, duration }, i) => (
      <Sequence key={i} from={SCENE_STARTS[i]} durationInFrames={duration}>
        <Scene durationInFrames={duration} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
