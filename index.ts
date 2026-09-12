import { registerRootComponent } from 'expo';
import App from './App';
import { registerAppWidget } from './src/services/widgetSyncService';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);

// Register Android Home Screen Widget task handler (safely ignored in Expo Go)
registerAppWidget();

