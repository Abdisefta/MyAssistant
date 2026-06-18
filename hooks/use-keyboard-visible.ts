import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

type KeyboardState = {
  visible: boolean;
  height: number;
};

export function useKeyboardState(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({ visible: false, height: 0 });

  useEffect(() => {
    const onShow = (event: KeyboardEvent) => {
      setState({
        visible: true,
        height: event.endCoordinates.height,
      });
    };

    const onHide = () => {
      setState({ visible: false, height: 0 });
    };

    const showEvents =
      Platform.OS === 'ios'
        ? ['keyboardWillShow', 'keyboardDidShow']
        : ['keyboardDidShow'];
    const hideEvents =
      Platform.OS === 'ios'
        ? ['keyboardWillHide', 'keyboardDidHide']
        : ['keyboardDidHide'];

    const subscriptions = [
      ...showEvents.map((event) => Keyboard.addListener(event, onShow)),
      ...hideEvents.map((event) => Keyboard.addListener(event, onHide)),
    ];

    return () => subscriptions.forEach((sub) => sub.remove());
  }, []);

  return state;
}

export function useKeyboardVisible(): boolean {
  return useKeyboardState().visible;
}
