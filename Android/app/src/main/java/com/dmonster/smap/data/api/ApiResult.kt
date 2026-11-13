package com.dmonster.smap.data.api

import retrofit2.HttpException
import java.io.IOException
import kotlinx.coroutines.CancellationException

sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val code: Int, val message: String) : ApiResult<Nothing>()
    data class NetworkError(val exception: Exception) : ApiResult<Nothing>()
}

suspend fun <T> safeApiCall(call: suspend () -> T): ApiResult<T> {
    return try {
        ApiResult.Success(call())
    } catch (e: CancellationException) {
        throw e
    } catch (e: HttpException) {
        android.util.Log.e("ApiResult", "HTTP 요청 실패", e)
        ApiResult.Error(e.code(), "요청을 처리하지 못했습니다.")
    } catch (e: IOException) {
        ApiResult.NetworkError(e)
    } catch (e: Exception) {
        // Catch serialization errors (JsonDecodingException, etc.)
        // that occur when API returns unexpected response format
        android.util.Log.e("ApiResult", "응답 처리 실패", e)
        ApiResult.Error(-1, "응답을 처리하지 못했습니다.")
    }
}
