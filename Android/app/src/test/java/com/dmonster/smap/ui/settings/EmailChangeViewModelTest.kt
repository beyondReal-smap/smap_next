package com.dmonster.smap.ui.settings

import android.content.SharedPreferences
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.auth.TokenStore
import com.dmonster.smap.data.model.EmailChangeRequest
import com.dmonster.smap.data.model.EmailCodeRequest
import com.dmonster.smap.data.model.EmailCodeResponse
import com.dmonster.smap.data.service.AuthService
import java.lang.reflect.InvocationTargetException
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
class EmailChangeViewModelTest {
    private var sends = 0
    private var changes = 0
    private var sendStatus = 200
    private var changeStatus = 200
    private var changeBody = "{}"
    private var lastChange: EmailChangeRequest? = null
    private var lastVerify: EmailCodeRequest? = null
    private val stored = HashMap<String, Any?>()
    private lateinit var vm: EmailChangeViewModel

    private fun httpError(status: Int, body: String = "{}") =
        HttpException(Response.error<Any>(status, body.toResponseBody("application/json".toMediaType())))

    private fun newVm(initialUserJson: String?): EmailChangeViewModel {
        if (initialUserJson != null) stored["user_data"] = initialUserJson
        val api = Proxy.newProxyInstance(SmapApi::class.java.classLoader, arrayOf(SmapApi::class.java)) { _, method, args ->
            when (method.name) {
                "sendEmailCode" -> {
                    sends++
                    if (sendStatus != 200) throw httpError(sendStatus)
                    EmailCodeResponse(true)
                }
                "verifyEmailCode" -> { lastVerify = args[0] as EmailCodeRequest; EmailCodeResponse(true, "signed-token") }
                "changeEmail" -> {
                    changes++
                    lastChange = args[0] as EmailChangeRequest
                    if (changeStatus != 200) throw httpError(changeStatus, changeBody)
                    EmailCodeResponse(true)
                }
                else -> error("unexpected API call: ${method.name}")
            }
        } as SmapApi
        val editor = Proxy.newProxyInstance(SharedPreferences.Editor::class.java.classLoader, arrayOf(SharedPreferences.Editor::class.java)) { proxy, method, args ->
            when (method.name) {
                "putString" -> { stored[args[0] as String] = args[1]; proxy }
                "putInt" -> { stored[args[0] as String] = args[1]; proxy }
                "commit" -> true
                else -> proxy
            }
        } as SharedPreferences.Editor
        val prefs = Proxy.newProxyInstance(SharedPreferences::class.java.classLoader, arrayOf(SharedPreferences::class.java)) { _, method, args ->
            when (method.name) {
                "getString" -> stored[args[0] as String] ?: args[1]
                "getInt" -> stored[args[0] as String] ?: args[1]
                "edit" -> editor
                else -> null
            }
        } as SharedPreferences
        val tokens = object : TokenStore {
            override fun getRefreshToken(): String? = null
            override fun saveRefreshToken(token: String) = Unit
            override fun clearRefreshToken() = Unit
        }
        return EmailChangeViewModel(AuthService(api, prefs, tokens))
    }

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        vm = newVm("""{"mt_idx":1,"mt_id":"01012345678"}""")
    }

    @After fun teardown() { Dispatchers.resetMain() }

    private val state get() = vm.uiState.value

    @Test fun `send then verify then register updates stored email`() {
        vm.setEmail(" New@Example.com ")
        vm.sendCode()
        assertEquals(EmailChangeViewModel.Step.CODE, state.step)
        assertEquals("new@example.com", state.email)
        assertEquals(600, state.timerSeconds)
        vm.setCode("123456")
        vm.confirm()
        assertEquals("change_email", lastVerify?.purpose)
        assertEquals("new@example.com", lastChange?.email)
        assertEquals("signed-token", lastChange?.verificationToken)
        assertTrue(state.isCompleted)
        assertEquals("new@example.com", state.currentEmail)
        assertTrue((stored["user_data"] as String).contains("new@example.com"))
    }

    @Test fun `email edit clears verification and cooldown`() {
        vm.setEmail("a@example.com")
        vm.sendCode()
        vm.setCode("123456")
        changeStatus = 409
        vm.confirm()
        assertEquals("signed-token", state.verificationToken)
        vm.setEmail("b@example.com")
        assertNull(state.verificationToken)
        assertEquals(EmailChangeViewModel.Step.EMAIL, state.step)
        assertEquals("", state.code)
        assertEquals(0, vm.remainingResendSeconds())
        vm.sendCode()
        assertEquals(2, sends)
    }

    @Test fun `back to email resets verification but keeps cooldown`() {
        vm.setEmail("a@example.com")
        vm.sendCode()
        vm.backToEmail()
        assertEquals(EmailChangeViewModel.Step.EMAIL, state.step)
        assertEquals(0, state.timerSeconds)
        assertTrue(vm.remainingResendSeconds() > 0)
    }

    @Test fun `cooldown blocks repeated send`() {
        vm.setEmail("a@example.com")
        vm.sendCode()
        vm.sendCode()
        assertEquals(1, sends)
        assertEquals(EmailChangeViewModel.MSG_WAIT, state.errorMessage)
    }

    @Test fun `same email as current is not sent`() {
        vm = newVm("""{"mt_idx":1,"mt_email":"me@example.com"}""")
        vm.setEmail("ME@example.com")
        assertTrue(state.isSameAsCurrent)
        assertFalse(state.canSend)
        vm.sendCode()
        assertEquals(0, sends)
    }

    @Test fun `409 and 429 show distinct messages`() {
        vm.setEmail("a@example.com")
        sendStatus = 409
        vm.sendCode()
        assertEquals("이미 다른 계정에서 사용 중인 이메일이에요.", state.errorMessage)
        assertEquals(EmailChangeViewModel.Step.EMAIL, state.step)
        sendStatus = 429
        vm.sendCode()
        assertEquals("요청이 많아요. 잠시 후 다시 시도해 주세요.", state.errorMessage)
        sendStatus = 503
        vm.sendCode()
        assertEquals("일시적인 오류예요. 잠시 후 다시 시도해 주세요.", state.errorMessage)
    }

    @Test fun `change 409 keeps token for retry and shows duplicate message`() {
        vm.setEmail("a@example.com")
        vm.sendCode()
        vm.setCode("123456")
        changeStatus = 409
        vm.confirm()
        assertEquals(EmailChangeViewModel.MSG_DUPLICATE, state.errorMessage)
        assertFalse(state.isCompleted)
        changeStatus = 200
        vm.confirm()
        assertEquals(2, changes)
        assertTrue(state.isCompleted)
    }

    @Test fun `reset clears state`() {
        vm.setEmail("a@example.com")
        vm.sendCode()
        vm.reset()
        assertEquals("", state.email)
        assertEquals(EmailChangeViewModel.Step.EMAIL, state.step)
        assertEquals(0, vm.remainingResendSeconds())
    }
}
