package com.dmonster.smap.ui.register

import android.content.SharedPreferences
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.auth.TokenStore
import com.dmonster.smap.data.model.EmailCodeResponse
import com.dmonster.smap.data.service.AuthService
import java.lang.reflect.Proxy
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class RegisterViewModelTest {
    private var sends = 0
    private var status = 200
    private lateinit var vm: RegisterViewModel

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        val api = Proxy.newProxyInstance(SmapApi::class.java.classLoader, arrayOf(SmapApi::class.java)) { _, method, _ ->
            when (method.name) {
                "sendEmailCode" -> {
                    sends++
                    if (status != 200) throw HttpException(Response.error<Any>(status, "{}".toResponseBody("application/json".toMediaType())))
                    EmailCodeResponse(true)
                }
                "verifyEmailCode" -> EmailCodeResponse(true, "signed-token")
                else -> error("unexpected API call: ${method.name}")
            }
        } as SmapApi
        val prefs = Proxy.newProxyInstance(SharedPreferences::class.java.classLoader, arrayOf(SharedPreferences::class.java)) { _, _, _ -> null } as SharedPreferences
        val tokens = object : TokenStore {
            override fun getRefreshToken(): String? = null
            override fun saveRefreshToken(token: String) = Unit
            override fun clearRefreshToken() = Unit
        }
        vm = RegisterViewModel(AuthService(api, prefs, tokens))
    }

    @After fun teardown() { Dispatchers.resetMain() }

    @Test fun `send then verify stores token`() {
        vm.setPhoneNumber("person@example.com")
        vm.sendVerificationCode()
        assertTrue(vm.uiState.value.verificationSent)
        vm.setVerificationCode("123456")
        vm.verifyCode()
        assertEquals("signed-token", vm.uiState.value.registerData.emailVerificationToken)
    }

    @Test fun `email edit clears verification and cooldown`() {
        vm.setPhoneNumber("person@example.com")
        vm.sendVerificationCode()
        vm.setVerificationCode("123456")
        vm.verifyCode()
        vm.setPhoneNumber("other@example.com")
        assertNull(vm.uiState.value.registerData.emailVerificationToken)
        assertFalse(vm.uiState.value.verificationSent)
        vm.sendVerificationCode()
        assertEquals(2, sends)
    }

    @Test fun `cooldown blocks repeated send`() {
        vm.setPhoneNumber("person@example.com")
        vm.sendVerificationCode()
        vm.sendVerificationCode()
        assertEquals(1, sends)
    }

    @Test fun `409 and 429 show distinct messages`() {
        vm.setPhoneNumber("person@example.com")
        status = 409
        vm.sendVerificationCode()
        assertEquals("이미 가입된 이메일입니다.", vm.uiState.value.errorMessage)
        status = 429
        vm.sendVerificationCode()
        assertEquals("요청이 많습니다. 잠시 후 다시 시도해주세요.", vm.uiState.value.errorMessage)
    }
}
