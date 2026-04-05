import React from 'react';
import{
    StyleSheet,
    View,
    Text,
    ImageBackground,
    Image,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import{useRouter} from 'expo-router';
import { SafeAreaFrameContext } from 'react-native-safe-area-context';

export default function StartScreen(){
    const router = useRouter();

    return(
        <ImageBackground
        source={require('../assets/images/background.jpg')}
        style={styles.background}
        resizeMode ="cover" 
        >
            <SafeAreaView style ={styles.container}>

                {/* Logo Section */}
                <View style = {styles.logoContainer}>
                    <Image 
                        source = {require('@/assets/images/logo.png')}
                        style = {styles.logo}
                        resizeMode = "contain"
                    />
                </View>

                {/* Interaction Section */}
                <View style = {styles.bottomSection}>
                    <TouchableOpacity
                    style = {styles.loginButton}
                    onPress = {() => router.push('/login')}
                    >
                        <Text style = {styles.loginButtonText}>LOGIN</Text>
                    </TouchableOpacity>
                    <View style ={styles.signupContainer}>
                        <Text style = {styles.footerText}>Don't have an account?</Text>
                        <TouchableOpacity onPress = {() => router.push('/signup')}>
                            <Text style = {styles.signupText}>SignUp</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background:{
        flex: 1,
        width: '100%',
        height:'100%',
    },
    container:{
        flex:1,
        justifyContent:'space-between',
        alignItems:'center',
        backgroundColor:'rgba(0,0,0,0.5)'
    },
    logoContainer:{
        marginTop: 0,
        alignItems:'center',
    },
    logo:{
        width:350,
        height:undefined,
        aspectRatio: 280 / 120,
    },
    bottomSection:{
        width: '100%',
        alignItems:'center',
        marginBottom: 73,
    },
    loginButton:{
        backgroundColor: '#8E949A',
        paddingVertical: 16,
        paddingHorizontal:80,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    loginButtonText:{
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: 1.5,
    },
    signupContainer:{
        flexDirection:'row',
        marginTop: 15,
    },
    footerText:{
        color:"#FFFFFF",
        fontSize: 14,
    },
    signupText:{
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        fontStyle: 'italic',
        textDecorationLine: 'underline',
    },
});