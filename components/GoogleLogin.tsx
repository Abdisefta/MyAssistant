import { StyleSheet, Text, View } from 'react-native';

import { useLocale } from '@/contexts/locale-context';

export default function GoogleLogin() {
  const { strings } = useLocale();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>G</Text>
      <Text style={styles.title}>{strings.gmail.title}</Text>
      <Text style={styles.subtitle}>{strings.gmail.subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D0D0D',
    paddingHorizontal: 32,
    gap: 12,
  },
  icon: {
    fontSize: 28,
    fontWeight: '700',
    color: '#8B7CF7',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#F5F5F5',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
