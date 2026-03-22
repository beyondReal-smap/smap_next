package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*

/**
 * MyPlace (saved-location) service (delegates to SmapApi via Retrofit).
 */
class MyPlaceService(private val api: SmapApi) {

    companion object {
        private const val TAG = "MyPlaceService"
    }

    /**
     * GET /locations/member/{memberId}
     */
    suspend fun getLocations(memberId: Int): List<SavedLocation> {
        return try {
            val locations = api.getLocations(memberId)
            Log.d(TAG, "[getLocations] ${locations.size} locations loaded")
            locations
        } catch (e: Exception) {
            Log.e(TAG, "[getLocations] error", e)
            emptyList()
        }
    }

    /**
     * POST /locations
     */
    suspend fun createLocation(
        memberId: Int,
        groupId: Int,
        title: String,
        address: String,
        lat: Double,
        lng: Double,
        memo: String? = null,
        enterAlarm: String? = "Y"
    ): SavedLocation? {
        return try {
            val body = mutableMapOf<String, Any>(
                "mt_idx" to memberId,
                "sgt_idx" to groupId,
                "slt_title" to title,
                "slt_add" to address,
                "slt_lat" to lat,
                "slt_long" to lng
            )
            memo?.let { body["slt_memo"] = it }
            enterAlarm?.let { body["slt_enter_alarm"] = it }

            val location = api.createLocation(body)
            Log.d(TAG, "[createLocation] created: ${location.name}")
            location
        } catch (e: Exception) {
            Log.e(TAG, "[createLocation] error", e)
            null
        }
    }

    /**
     * PUT /locations/{locationId}
     */
    suspend fun updateLocation(
        locationId: Int,
        title: String,
        address: String,
        lat: Double,
        lng: Double,
        memo: String? = null,
        enterAlarm: String? = null
    ): Boolean {
        return try {
            val body = mutableMapOf<String, Any>(
                "slt_title" to title,
                "slt_add" to address,
                "slt_lat" to lat,
                "slt_long" to lng
            )
            memo?.let { body["slt_memo"] = it }
            enterAlarm?.let { body["slt_enter_alarm"] = it }

            api.updateLocation(locationId, body)
            Log.d(TAG, "[updateLocation] updated")
            true
        } catch (e: Exception) {
            Log.e(TAG, "[updateLocation] error", e)
            false
        }
    }

    /**
     * DELETE /locations/{locationId}
     */
    suspend fun deleteLocation(locationId: Int): Boolean {
        return try {
            api.deleteLocation(locationId)
            Log.d(TAG, "[deleteLocation] deleted")
            true
        } catch (e: Exception) {
            Log.e(TAG, "[deleteLocation] error", e)
            false
        }
    }
}
