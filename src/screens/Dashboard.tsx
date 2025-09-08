import React, {useEffect, useState} from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { getExpensesForMonth } from "../services/ExpenseService";
import { PieChart } from "react-native-chart-kit";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";

const screenWidth = Dimensions.get("window").width;

export default function Dashboard({ navigation, user }: any) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(()=>{
    (async()=>{
      const now = new Date();
      const res = await getExpensesForMonth(now.getFullYear(), now.getMonth());
      setExpenses(res);
      // aggregate
      const agg:any = {};
      res.forEach((r:any)=>{
        const cat = r.category || "Other";
        agg[cat] = (agg[cat] || 0) + (r.amount||0);
      });
      const data = Object.entries(agg).map(([name, val], idx)=>({
        name,
        population: Number(val),
        color: ["#0066FF","#00C48C","#FFB400","#FF4D4F","purple"][idx%5],
        legendFontColor:"#7F7F7F",
        legendFontSize:12
      }));
      setChartData(data);
    })();
  },[]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={{fontSize:22,fontWeight:"700"}}>This Month</Text>
        <TouchableOpacity onPress={()=>signOut(auth)}><Text style={{color:"#0066FF"}}>Logout</Text></TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.addCard} onPress={()=>navigation.navigate("AddExpense",{user})}>
        <Text style={{color:"#fff",fontWeight:"700"}}>+ Add Expense</Text>
      </TouchableOpacity>

      {chartData.length>0 && (
        <PieChart data={chartData} width={screenWidth-32} height={220} accessor="population" chartConfig={{backgroundGradientFrom:"#fff",backgroundGradientTo:"#fff",color:()=>`rgba(0,0,0,1)`}}/>
      )}

      <Text style={{fontSize:18, marginTop:12}}>Recent</Text>
      <FlatList data={expenses} keyExtractor={i=>i.id} renderItem={({item})=>(
        <View style={styles.item}>
          <Text style={{fontWeight:"600"}}>{item.category} • ₹{item.amount}</Text>
          <Text style={{color:"#666"}}>{item.description || ""}</Text>
        </View>
      )} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,padding:16,backgroundColor:"#F8FAFF"},
  headerRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  addCard:{backgroundColor:"#0066FF",padding:12,borderRadius:10,alignItems:"center",marginTop:12},
  item:{backgroundColor:"#fff",padding:12,borderRadius:8,marginTop:8}
});
