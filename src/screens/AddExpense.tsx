import React, {useState} from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { addExpense } from "../services/ExpenseService";

export default function AddExpense({ navigation, route }: any) {
  const user = route.params?.user || route.user;
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("General");

  async function save(){
    const a = parseFloat(amount);
    if(!a || !user) return Alert.alert("Validation", "Enter amount");
    try{
      await addExpense(a, category, desc); // pass args matching service
      navigation.goBack();
    }catch(e:any){
      Alert.alert("Error", e.message||String(e));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={{fontSize:18, marginBottom:8}}>Amount</Text>
      <TextInput keyboardType="numeric" value={amount} onChangeText={setAmount} style={styles.input} placeholder="0.00" />
      <Text style={{fontSize:18, marginBottom:8}}>Category</Text>
      <TextInput value={category} onChangeText={setCategory} style={styles.input} />
      <Text style={{fontSize:18, marginBottom:8}}>Description (optional)</Text>
      <TextInput value={desc} onChangeText={setDesc} style={styles.input} />
      <TouchableOpacity style={styles.button} onPress={save}>
        <Text style={{color:"#fff"}}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,padding:16,backgroundColor:"#F8FAFF"},
  input:{backgroundColor:"#fff",padding:12,borderRadius:8,marginBottom:12},
  button:{backgroundColor:"#00C48C",padding:12,alignItems:"center",borderRadius:8,marginTop:8}
});
