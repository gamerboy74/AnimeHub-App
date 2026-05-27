import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PaymentCard {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  primary: boolean;
}

export function usePaymentCards(userId?: string) {
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCards([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    AsyncStorage.getItem(`user_cards_${userId}`)
      .then(cached => {
        if (cached) {
          setCards(JSON.parse(cached));
        } else {
          setCards([]);
        }
      })
      .catch(err => {
        console.error('[PaymentCards] Failed to load cards:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [userId]);

  const addCard = useCallback(async (brand: string, last4: string, expiry: string) => {
    if (!userId) return;
    const newCard: PaymentCard = {
      id: Date.now().toString(),
      brand,
      last4: last4.trim(),
      expiry: expiry.trim(),
      primary: cards.length === 0,
    };
    const updated = [...cards, newCard];
    setCards(updated);
    await AsyncStorage.setItem(`user_cards_${userId}`, JSON.stringify(updated));
  }, [userId, cards]);

  const deleteCard = useCallback(async (id: string) => {
    if (!userId) return;
    const updated = cards.filter(x => x.id !== id);
    // If we deleted the primary card and have others left, make the first one primary
    if (cards.find(x => x.id === id)?.primary && updated.length > 0) {
      updated[0].primary = true;
    }
    setCards(updated);
    await AsyncStorage.setItem(`user_cards_${userId}`, JSON.stringify(updated));
  }, [userId, cards]);

  const setPrimaryCard = useCallback(async (id: string) => {
    if (!userId) return;
    const updated = cards.map(x => ({ ...x, primary: x.id === id }));
    setCards(updated);
    await AsyncStorage.setItem(`user_cards_${userId}`, JSON.stringify(updated));
  }, [userId, cards]);

  return {
    cards,
    isLoading,
    addCard,
    deleteCard,
    setPrimaryCard,
  };
}
