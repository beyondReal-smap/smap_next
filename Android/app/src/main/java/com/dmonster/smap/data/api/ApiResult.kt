package com.dmonster.smap.data.api

import retrofit2.HttpException
import java.io.IOException

sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val code: Int, val message: String) : ApiResult<Nothing>()
    data class NetworkError(val exception: Exception) : ApiResult<Nothing>()
}

suspend fun <T> safeApiCall(call: suspend () -> T): ApiResult<T> {
    return try {
        ApiResult.Success(call())
    } catch (e: HttpException) {
        ApiResult.Error(e.code(), e.message())
    } catch (e: IOException) {
        ApiResult.NetworkError(e)
    } catch (e: Exception) {
        // Catch serialization errors (JsonDecodingException, etc.)
        // that occur when API returns unexpected response format
        ApiResult.Error(-1, e.message ?: "알 수 없는 오류가 발생했습니다")
    }
}
