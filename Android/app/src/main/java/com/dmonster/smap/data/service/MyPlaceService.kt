package com.dmonster.smap.data.service

import android.util.Log
import com.dmonster.smap.data.api.SmapApi
import com.dmonster.smap.data.model.*

/**
 * MyPlace (saved-location) service (delegates to SmapApi via Retrofit).
 *
 * NOTE: Methods intentionally do NOT catch exceptions.
 * Errors propagate to the ViewModel's safeApiCall wrapper for proper handling.
 */
class MyPlaceService(private val api: SmapApi) {

    companion object {
        private const val TAG = "MyPlaceService"
    }

    /**
     * GET /locations/member/{memberId}
     */
    suspend fun getLocations(memberId: Int): List<SavedLocation> {
        val locations = api.getLocations(memberId)
        Log.d(TAG, "[getLocations] ${locations.size} locations loaded")
        return locations
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
        val body = CreateLocationRequest(
            mtIdx = memberId,
            sgtIdx = groupId,
            sltTitle = title,
            sltAdd = address,
            sltLat = lat,
            sltLong = lng,
            sltMemo = memo,
            sltEnterAlarm = enterAlarm
        )

        val location = api.createLocation(body)
        Log.d(TAG, "[createLocation] created: ${location.name}")
        return location
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
        val body = UpdateLocationRequest(
            sltTitle = title,
            sltAdd = address,
            sltLat = lat,
            sltLong = lng,
            sltMemo = memo,
            sltEnterAlarm = enterAlarm
        )

        api.updateLocation(locationId, body)
        Log.d(TAG, "[updateLocation] updated")
        return true
    }

    /**
     * DELETE /locations/{locationId}
     */
    suspend fun deleteLocation(locationId: Int): Boolean {
        api.deleteLocation(locationId)
        Log.d(TAG, "[deleteLocation] deleted")
        return true
    }
}
