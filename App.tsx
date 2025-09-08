import React, { useEffect, useState } from "react";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./src/firebaseConfig";
import AuthScreen from "./src/screens/AuthScreen";
import Dashboard from "./src/screens/Dashboard";
import AddExpense from "./src/screens/AddExpense";

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (initializing) setInitializing(false);
    });
    return unsub;
  },[]);

  if (initializing) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Dashboard" options={{title:"Expense Tracker"}}>
              {props => <Dashboard {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen name="AddExpense" options={{title:"Add Expense"}}>
              {props => <AddExpense {...props} user={user} />}
            </Stack.Screen>
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} options={{headerShown:false}} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
