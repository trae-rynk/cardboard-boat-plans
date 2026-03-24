/**
 * Captain Bob Chat Tab
 *
 * This tab is always visible in the tab bar but shows a "Premium only" gate
 * for customers who haven't purchased the Premium package.
 *
 * For Premium customers, it renders the full Captain Bob chat screen.
 * The chat credentials (orderId + chatToken) are stored in AsyncStorage
 * after a Premium purchase is confirmed.
 */
import CaptainBobScreen from '@/app/captain-bob';

export default CaptainBobScreen;
