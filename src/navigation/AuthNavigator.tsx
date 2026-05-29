import React, { useState } from 'react';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

export default function AuthNavigator() {
  const [showRegister, setShowRegister] = useState(false);

  if (showRegister) {
    return <RegisterScreen onNavigateToLogin={() => setShowRegister(false)} />;
  }
  return <LoginScreen onNavigateToRegister={() => setShowRegister(true)} />;
}
