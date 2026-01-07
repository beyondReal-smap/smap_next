package com.dmonster.smap.ui.myplace

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.widget.TextView
import com.dmonster.smap.R
import com.naver.maps.map.overlay.InfoWindow
import com.naver.maps.map.overlay.Marker

/**
 * Custom InfoWindow adapter for location labels
 * Displays location name in a black rounded rectangle with white text
 */
class LocationInfoWindowAdapter(private val context: Context) : InfoWindow.ViewAdapter() {
    
    override fun getView(infoWindow: InfoWindow): View {
        android.util.Log.d("LocationInfoWindowAdapter", "getView called for marker tag: ${infoWindow.marker?.tag}")
        
        // Create a new view instance for each call because multiple InfoWindows
        // might be open simultaneously, and a View can only have one parent.
        val view = LayoutInflater.from(context).inflate(R.layout.info_window_location, null)
        val textView = view.findViewById<TextView>(R.id.info_window_text)
        
        // Get location name from marker tag
        val marker = infoWindow.marker
        val locationName = marker?.tag as? String ?: ""
        textView?.text = locationName
        
        return view
    }
}
