<?if(!defined("B_PROLOG_INCLUDED") || B_PROLOG_INCLUDED!==true)die();
/** @var array $arParams */
/** @var array $arResult */
/** @global CMain $APPLICATION */
/** @global CUser $USER */
/** @global CDatabase $DB */
/** @var CBitrixComponentTemplate $this */
/** @var string $templateName */
/** @var string $templateFile */
/** @var string $templateFolder */
/** @var string $componentPath */
/** @var CBitrixComponent $component */
$this->setFrameMode(true);
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
if (!empty($arResult['PROPERTIES']['PHOTO']['VALUE'])) {
    foreach ($arResult['PROPERTIES']['PHOTO']['VALUE'] as $v) {
        $PHOTOS[] = $getPhotoForSlider($v);
    }
}
$arResult['PHOTOS'] = $PHOTOS;


?>
<div class="container service">
		<h1 class="h1 mt-0"><?=$arResult["NAME"]?></h1>


      <?php if ($arResult['PREVIEW_TEXT'] != '' && (       $arParams['DISPLAY_PREVIEW_TEXT_MODE'] === 'S'
          || ($arParams['DISPLAY_PREVIEW_TEXT_MODE'] === 'E' && $arResult['DETAIL_TEXT'] == '')
        )
      ) {
          echo $arResult['PREVIEW_TEXT_TYPE'] === 'html' ? $arResult['PREVIEW_TEXT'] : '<p>'.$arResult['PREVIEW_TEXT'].'</p>';
      }

      if ($arResult['DETAIL_TEXT'] != '') {
          echo $arResult['DETAIL_TEXT_TYPE'] === 'html' ? $arResult['DETAIL_TEXT'] : '<p>'.$arResult['DETAIL_TEXT'].'</p>';
      } ?>


		</div>

</div>
