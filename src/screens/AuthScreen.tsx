import React, {useState} from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseConfig";

export default function AuthScreen(){
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  async function handleSubmit(){
    try{
      if(isRegister){
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    }catch(e:any){
      Alert.alert("Auth error", e.message || String(e));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Expense Tracker</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none"/>
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry/>
      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{isRegister ? "Register" : "Login"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={()=>setIsRegister(!isRegister)}>
        <Text style={{color:"#0066FF", marginTop:12}}>{isRegister ? "Have an account? Login" : "New user? Register"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,alignItems:"center",justifyContent:"center",padding:20,backgroundColor:"#F8FAFF"},
  title:{fontSize:28,fontWeight:"700",marginBottom:20},
  input:{width:"100%",padding:12,backgroundColor:"#fff",borderRadius:10,marginVertical:8,elevation:2},
  button:{backgroundColor:"#0066FF",padding:12,borderRadius:10,width:"100%",alignItems:"center",marginTop:8},
  buttonText:{color:"#fff",fontWeight:"600"}
});
