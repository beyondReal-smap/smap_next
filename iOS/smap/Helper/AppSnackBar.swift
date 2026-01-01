//
//  AppSnackBar.swift
//  smap
//
//  Created by  Corp. Dmonster on 12/15/23.
//

import UIKit
import SnackBar_swift

class AppSnackBar: SnackBar {
    
    override var style: SnackBarStyle {
        var style = SnackBarStyle()
        style.background = .black
        style.textColor = .white
        style.actionTextColor = .blue
        style.actionTextColorAlpha = 1.0
        return style
    }
}
