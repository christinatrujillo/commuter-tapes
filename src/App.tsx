import { useRoute } from './lib/router'
import { DeckScreen } from './screens/Deck'
import { ExploreScreen } from './screens/Explore'
import { HomeScreen } from './screens/Home'
import { DrillScreen, LessonScreen, WeakSpotScreen } from './screens/Lesson'
import { PracticeScreen } from './screens/Practice'
import { RehearsalScreen } from './screens/Rehearsal'
import { SettingsScreen } from './screens/Settings'
import { SprintScreen } from './screens/Sprint'
import { StatsScreen } from './screens/Stats'

export function App() {
  const { parts, query } = useRoute()
  switch (parts[0]) {
    case 'lesson':
      return <LessonScreen key={parts[1]} lessonId={parts[1] ?? ''} />
    case 'rehearse':
      return <RehearsalScreen key={parts[1]} lessonId={parts[1] ?? ''} />
    case 'drill':
      return <DrillScreen query={query} />
    case 'weak':
      return <WeakSpotScreen />
    case 'sprint':
      return <SprintScreen presetId={query.get('p') ?? ''} />
    case 'tape':
      return <DeckScreen unitId={parts[1] ?? ''} />
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
