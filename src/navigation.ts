import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';

export type AppNavigation = NativeStackNavigationProp<RootStackParamList>;

export function useAppNavigation(): AppNavigation {
  return useNavigation<AppNavigation>();
}
