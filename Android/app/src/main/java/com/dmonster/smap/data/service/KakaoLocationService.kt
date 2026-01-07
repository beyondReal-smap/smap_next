package com.dmonster.smap.data.service

import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URLEncoder

data class KakaoPlace(
    val id: String,
    val placeName: String,
    val addressName: String,
    val roadAddressName: String,
    val x: Double,
    val y: Double
)

class KakaoLocationService {
    private val client = OkHttpClient()
    private val apiKey = "7fbf60571daf54ca5bee8373a1f31d2d"

    suspend fun searchLocation(query: String): List<KakaoPlace> = withContext(Dispatchers.IO) {
        val encodedQuery = URLEncoder.encode(query, "UTF-8")
        val url = "https://dapi.kakao.com/v2/local/search/keyword.json?query=$encodedQuery"
        
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "KakaoAK $apiKey")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext emptyList()
            
            val body = response.body?.string() ?: return@withContext emptyList()
            val json = JSONObject(body)
            val documents = json.getJSONArray("documents")
            
            val places = mutableListOf<KakaoPlace>()
            for (i in 0 until documents.length()) {
                val doc = documents.getJSONObject(i)
                places.add(
                    KakaoPlace(
                        id = doc.getString("id"),
                        placeName = doc.getString("place_name"),
                        addressName = doc.getString("address_name"),
                        roadAddressName = doc.getString("road_address_name"),
                        x = doc.getString("x").toDouble(),
                        y = doc.getString("y").toDouble()
                    )
                )
            }
            places
        }
    }
}
