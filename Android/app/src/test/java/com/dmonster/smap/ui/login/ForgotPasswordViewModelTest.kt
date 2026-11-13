package com.dmonster.smap.ui.login

import android.content.SharedPreferences
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.auth.TokenStore
import com.dmonster.smap.data.model.EmailCodeRequest
import com.dmonster.smap.data.model.EmailCodeResponse
import com.dmonster.smap.data.model.EmailResetRequest
import com.dmonster.smap.data.model.PhoneResetRequest
import com.dmonster.smap.data.model.PhoneResetResponse
import com.dmonster.smap.data.model.SmsVerificationRequest
import com.dmonster.smap.data.model.SmsVerificationResponse
import com.dmonster.smap.data.model.VerifySmsCodeRequest
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
class ForgotPasswordViewModelTest {
    private var smsSends = 0
    private var emailSends = 0
    private var smsSendResult = SmsVerificationResponse(success = true)
    private var smsVerifyResult = SmsVerificationResponse(success = true)
    private var phoneResetResult = PhoneResetResponse(success = true, message = "ok")
    private var smsSendStatus = 200
    private var lastSmsSend: SmsVerificationRequest? = null
    private var lastSmsVerify: VerifySmsCodeRequest? = null
    private var lastPhoneReset: PhoneResetRequest? = null
    private var lastEmailReset: EmailResetRequest? = null
    private var lastEmailSend: EmailCodeRequest? = null
    private lateinit var vm: ForgotPasswordViewModel

    private fun httpError(status: Int) =
        HttpException(Response.error<Any>(status, "{}".toResponseBody("application/json".toMediaType())))

    private fun newVm(): ForgotPasswordViewModel {
        val api = Proxy.newProxyInstance(SmapApi::class.java.classLoader, arrayOf(SmapApi::class.java)) { _, method, args ->
            when (method.name) {
                "sendSmsVerification" -> {
                    smsSends++
                    lastSmsSend = args[0] as SmsVerificationRequest
                    if (smsSendStatus != 200) throw httpError(smsSendStatus)
                    smsSendResult
                }
                "verifySmsCode" -> { lastSmsVerify = args[0] as VerifySmsCodeRequest; smsVerifyResult }
                "resetPasswordByPhone" -> { lastPhoneReset = args[0] as PhoneResetRequest; phoneResetResult }
                "sendEmailCode" -> { emailSends++; lastEmailSend = args[0] as EmailCodeRequest; EmailCodeResponse(true) }
                "verifyEmailCode" -> EmailCodeResponse(true, "signed-token")
                "resetPasswordByEmail" -> { lastEmailReset = args[0] as EmailResetRequest; EmailCodeResponse(true) }
                else -> error("unexpected API call: ${method.name}")
            }
        } as SmapApi
        val prefs = Proxy.newProxyInstance(SharedPreferences::class.java.classLoader, arrayOf(SharedPreferences::class.java)) { _, _, _ -> null } as SharedPreferences
        val tokens = object : TokenStore {
            override fun getRefreshToken(): String? = null
            override fun saveRefreshToken(token: String) = Unit
            override fun clearRefreshToken() = Unit
        }
        return ForgotPasswordViewModel(AuthService(api, prefs, tokens))
    }

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        vm = newVm()
    }

    @After fun teardown() { Dispatchers.resetMain() }

    @Test fun `classify separates email phone and invalid`() {
        assertEquals(ForgotPasswordViewModel.InputKind.EMAIL, ForgotPasswordViewModel.classify(" a@b.com "))
        assertEquals(ForgotPasswordViewModel.InputKind.PHONE, ForgotPasswordViewModel.classify("010-1234-5678"))
        assertEquals(ForgotPasswordViewModel.InputKind.PHONE, ForgotPasswordViewModel.classify("0212345678"))
        assertEquals(ForgotPasswordViewModel.InputKind.INVALID, ForgotPasswordViewModel.classify("123456789"))
        assertEquals(ForgotPasswordViewModel.InputKind.INVALID, ForgotPasswordViewModel.classify("010123456789"))
        assertEquals(ForgotPasswordViewModel.InputKind.INVALID, ForgotPasswordViewModel.classify("abc"))
    }

    @Test fun `phone input uses sms path with digits only`() {
        vm.updatePhoneNumber("010-1234-5678")
        vm.checkUserAndSendCode()
        assertEquals(1, smsSends)
        assertEquals(0, emailSends)
        assertEquals("01012345678", lastSmsSend?.phoneNumber)
        assertEquals(ForgotPasswordViewModel.Step.VERIFICATION, vm.currentStep.value)
        assertEquals(ForgotPasswordViewModel.InputKind.PHONE, vm.sentKind.value)
        assertEquals(ForgotPasswordViewModel.SMS_TIMER_SECONDS, vm.verificationTimer.value)
    }

    @Test fun `email input keeps email path`() {
        vm.updatePhoneNumber(" A@Example.com ")
        vm.checkUserAndSendCode()
        assertEquals(0, smsSends)
        assertEquals(1, emailSends)
        assertEquals("a@example.com", lastEmailSend?.email)
        assertEquals("reset_password", lastEmailSend?.purpose)
        assertEquals(ForgotPasswordViewModel.InputKind.EMAIL, vm.sentKind.value)
    }

    @Test fun `invalid input sends nothing`() {
        vm.updatePhoneNumber("12345")
        vm.checkUserAndSendCode()
        assertEquals(0, smsSends + emailSends)
        assertNotNull(vm.errorMessage.value)
        assertEquals(ForgotPasswordViewModel.Step.PHONE, vm.currentStep.value)
    }

    @Test fun `server rejection of sms send keeps step and shows server message`() {
        smsSendResult = SmsVerificationResponse(success = false, error = "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.")
        vm.updatePhoneNumber("01012345678")
        vm.checkUserAndSendCode()
        assertEquals(ForgotPasswordViewModel.Step.PHONE, vm.currentStep.value)
        assertEquals("너무 많은 요청입니다. 잠시 후 다시 시도해주세요.", vm.errorMessage.value)
        // 발송 실패는 쿨다운을 시작하지 않는다
        vm.checkUserAndSendCode()
        assertEquals(2, smsSends)
    }

    @Test fun `http failure on sms send shows mapped message`() {
        smsSendStatus = 503
        vm.updatePhoneNumber("01012345678")
        vm.checkUserAndSendCode()
        assertEquals(ForgotPasswordViewModel.Step.PHONE, vm.currentStep.value)
        assertEquals("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", vm.errorMessage.value)
    }

    @Test fun `resend within 60 seconds is blocked`() {
        vm.updatePhoneNumber("01012345678")
        vm.checkUserAndSendCode()
        vm.checkUserAndSendCode()
        assertEquals(1, smsSends)
        assertEquals(ForgotPasswordViewModel.MSG_WAIT, vm.errorMessage.value)
    }

    @Test fun `wrong code is judged by server and blocks next step`() {
        vm.updatePhoneNumber("01012345678")
        vm.checkUserAndSendCode()
        smsVerifyResult = SmsVerificationResponse(success = false, error = "인증번호가 일치하지 않습니다.")
        vm.updateVerificationCode("111111")
        vm.verifyCode()
        assertEquals("111111", lastSmsVerify?.code)
        assertEquals("01012345678", lastSmsVerify?.phoneNumber)
        assertEquals(ForgotPasswordViewModel.Step.VERIFICATION, vm.currentStep.value)
        assertEquals("인증번호가 일치하지 않습니다.", vm.errorMessage.value)
    }

    @Test fun `phone flow end to end reaches complete`() {
        vm.updatePhoneNumber("010-1234-5678")
        vm.checkUserAndSendCode()
        vm.updateVerificationCode("123456")
        vm.verifyCode()
        assertEquals(ForgotPasswordViewModel.Step.NEW_PASSWORD, vm.currentStep.value)
        vm.updateNewPassword("Password1!")
        vm.updateConfirmPassword("Password1!")
        vm.resetPassword()
        assertEquals(ForgotPasswordViewModel.Step.COMPLETE, vm.currentStep.value)
        assertEquals("01012345678", lastPhoneReset?.phone)
        assertEquals("Password1!", lastPhoneReset?.newPassword)
        assertNull(lastEmailReset)
    }

    @Test fun `server failure message on phone reset keeps step`() {
        vm.updatePhoneNumber("01012345678")
        vm.checkUserAndSendCode()
        vm.updateVerificationCode("123456")
        vm.verifyCode()
        phoneResetResult = PhoneResetResponse(success = false, message = "등록되지 않은 전화번호입니다.")
        vm.updateNewPassword("Password1!")
        vm.updateConfirmPassword("Password1!")
        vm.resetPassword()
        assertEquals(ForgotPasswordViewModel.Step.NEW_PASSWORD, vm.currentStep.value)
        assertEquals("등록되지 않은 전화번호입니다.", vm.errorMessage.value)
    }

    @Test fun `editing the input discards sms verification`() {
        vm.updatePhoneNumber("01012345678")
        vm.checkUserAndSendCode()
        vm.updateVerificationCode("123456")
        vm.verifyCode()
        vm.updatePhoneNumber("01099998888")
        vm.updateNewPassword("Password1!")
        vm.updateConfirmPassword("Password1!")
        vm.resetPassword()
        assertNull(lastPhoneReset)
        assertEquals(ForgotPasswordViewModel.Step.NEW_PASSWORD, vm.currentStep.value)
    }

    @Test fun `email flow end to end still works`() {
        vm.updatePhoneNumber("a@example.com")
        vm.checkUserAndSendCode()
        assertEquals(ForgotPasswordViewModel.EMAIL_TIMER_SECONDS, vm.verificationTimer.value)
        vm.updateVerificationCode("123456")
        vm.verifyCode()
        vm.updateNewPassword("Password1!")
        vm.updateConfirmPassword("Password1!")
        vm.resetPassword()
        assertEquals(ForgotPasswordViewModel.Step.COMPLETE, vm.currentStep.value)
        assertEquals("signed-token", lastEmailReset?.verificationToken)
        assertNull(lastPhoneReset)
    }
}
