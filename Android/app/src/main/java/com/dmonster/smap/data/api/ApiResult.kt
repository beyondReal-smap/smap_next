package com.dmonster.smap.data.api

import com.dmonster.smap.data.model.ParsedApiDetail
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import retrofit2.HttpException
import java.io.IOException

sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(
        val code: Int,
        val message: String,
        val detailCode: String? = null,
        val detailMessage: String? = null
    ) : ApiResult<Nothing>()
    data class NetworkError(val exception: Exception) : ApiResult<Nothing>()
}

private val errorJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
}

/**
 * FastAPI 오류 응답 `{"detail": "..."}` 또는 `{"detail": {"code": "...", "message": "..."}}` 파싱.
 * 단위 테스트에서도 직접 호출할 수 있도록 순수 함수로 분리한다.
 */
fun parseFastApiErrorDetail(errorBody: String?): ParsedApiDetail? {
    if (errorBody.isNullOrBlank()) return null
    return try {
        val root = errorJson.parseToJsonElement(errorBody).jsonObject
        val detailElement = root["detail"] ?: return null
        when (detailElement) {
            is JsonPrimitive -> {
                val msg = detailElement.contentOrNull?.takeIf { it.isNotBlank() }
                if (msg != null) ParsedApiDetail(code = null, message = msg) else null
            }
            is JsonObject -> {
                val code = (detailElement["code"] as? JsonPrimitive)?.contentOrNull
                val msg = (detailElement["message"] as? JsonPrimitive)?.contentOrNull
                if (code != null || msg != null) ParsedApiDetail(code = code, message = msg) else null
            }
            else -> null
        }
    } catch (_: Exception) {
        null
    }
}

suspend fun <T> safeApiCall(call: suspend () -> T): ApiResult<T> {
    return try {
        ApiResult.Success(call())
    } catch (e: CancellationException) {
        throw e
    } catch (e: HttpException) {
        android.util.Log.e("ApiResult", "HTTP 요청 실패", e)
        val rawBody = try {
            e.response()?.errorBody()?.string()
        } catch (_: Exception) {
            null
        }
        val parsed = parseFastApiErrorDetail(rawBody)
        ApiResult.Error(
            code = e.code(),
            message = "요청을 처리하지 못했습니다.",
            detailCode = parsed?.code,
            detailMessage = parsed?.message
        )
    } catch (e: IOException) {
        ApiResult.NetworkError(e)
    } catch (e: Exception) {
        // Catch serialization errors (JsonDecodingException, etc.)
        // that occur when API returns unexpected response format
        android.util.Log.e("ApiResult", "응답 처리 실패", e)
        ApiResult.Error(-1, "응답을 처리하지 못했습니다.")
    }
}
