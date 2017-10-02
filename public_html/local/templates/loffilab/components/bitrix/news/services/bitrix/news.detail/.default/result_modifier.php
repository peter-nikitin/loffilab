<? if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

/**
 * @var CBitrixComponentTemplate $this
 * @var CatalogElementComponent $component
 */





/* SLIDER PHOTOS */
$arPhotoSizes = array(
    'thumb' => array('width' => 85, 'height' => 57),
    'big'   => array('width' => 1000, 'height' => 650),
    'full'  => array('width' => 1500, 'height' => 1000)
);

$getPhotoForSlider = function ($fileId) use ($arPhotoSizes) {
    $newPhoto = array();
    foreach ($arPhotoSizes as $key => $size) {
        $resizeMethod = $key == 'thumb' ? BX_RESIZE_IMAGE_EXACT : BX_RESIZE_IMAGE_PROPORTIONAL;
        $file = CFile::ResizeImageGet($fileId, $size, $resizeMethod);
        $newPhoto[$key] = $file['src'];
    }
    return $newPhoto;
};

$PHOTOS = array();
if (!empty($arResult['DETAIL_PICTURE'])) {
    $PHOTOS[] = $getPhotoForSlider($arResult['DETAIL_PICTURE']['ID']);
}
if (!empty($arResult['PROPERTIES']['MORE_PHOTO']['VALUE'])) {
    foreach ($arResult['PROPERTIES']['MORE_PHOTO']['VALUE'] as $v) {
        $PHOTOS[] = $getPhotoForSlider($v);
    }
}
$arResult['PHOTOS'] = $PHOTOS;
