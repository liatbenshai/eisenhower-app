import WeeklyPlanner from '../components/Planning/WeeklyPlanner';
import Header from '../components/Layout/Header';

/**
 * דף תכנון שבועי
 */
function PlannerPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="pb-20">
        <WeeklyPlanner />
      </div>
    </div>
  );
}

export default PlannerPage;
