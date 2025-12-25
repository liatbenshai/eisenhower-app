import SmartDayPlanner from '../components/DailyView/SmartDayPlanner';

/**
 * דף תכנון יום חכם
 * מסך ראשי חדש עם תכנון אוטומטי
 */
function SmartPlannerPage() {
  return (
    <main className="min-h-screen pb-20 pt-4">
      <SmartDayPlanner />
    </main>
  );
}

export default SmartPlannerPage;
