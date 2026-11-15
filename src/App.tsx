import { useEffect } from 'react'
import { stopSounds } from './audio/sound'
import { Guide } from './components/Guide'
import { useRoute } from './lib/router'
import { ExploreScreen } from './screens/Explore'
import { HomeScreen } from './screens/Home'
import { DrillScreen, LessonScreen, ReviewScreen, TheoryJamScreen, WeakSpotScreen } from './screens/Lesson'
import { PracticeScreen } from './screens/Practice'
import { RehearsalScreen } from './screens/Rehearsal'
import { SettingsScreen } from './screens/Settings'
import { SprintScreen } from './screens/Sprint'
import { StartScreen } from './screens/Start'
import { StatsScreen } from './screens/Stats'
import { useProgress } from './store/progress'

export function App() {
  const { parts, query } = useRoute()
  // Changing screens cuts off anything the last one was still playing.
  const where = `${parts.join('/')}?${query}`
  useEffect(() => stopSounds(), [where])
  // Someone brand new picks where to start before anything else, the tour included.
  const askStart = useProgress((s) => !s.startChosen && !s.guideDone && Object.keys(s.lessons).length === 0)
  if (askStart) return <StartScreen />
  return (
    <>
      <Screen parts={parts} query={query} />
      <Guide />
    </>
  )
}

function Screen({ parts, query }: { parts: string[]; query: URLSearchParams }) {
  switch (parts[0]) {
    case 'lesson':
      return <LessonScreen key={parts[1]} lessonId={parts[1] ?? ''} />
    case 'rehearse':
      return <RehearsalScreen key={parts[1]} lessonId={parts[1] ?? ''} />
    case 'drill':
      return <DrillScreen query={query} />
    case 'weak':
      return <WeakSpotScreen />
    case 'jam':
      return <TheoryJamScreen key={query.get('t')} jamId={query.get('t') ?? ''} />
    case 'review':
      return <ReviewScreen />
    case 'sprint':
      return <SprintScreen presetId={query.get('p') ?? ''} />
    case 'tape':
      // A tape's page is its paper insert, pulled out over the rack on the Tapes tab.
      return <HomeScreen tapeId={parts[1] ?? ''} />
    case 'settings':
      return <SettingsScreen />
    case 'practice':
      return <PracticeScreen />
    case 'explore':
      return <ExploreScreen />
    case 'stats':
      return <StatsScreen />
    default:
      return <HomeScreen />
  }
}
