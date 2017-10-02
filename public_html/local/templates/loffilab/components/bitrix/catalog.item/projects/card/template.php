<?php if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) {
    die();
}

use \Bitrix\Main\Localization\Loc;

/**
 * @global CMain $APPLICATION
 * @var array $arParams
 * @var array $item
 * @var array $actualItem
 * @var array $minOffer
 * @var array $itemIds
 * @var array $price
 * @var array $measureRatio
 * @var bool $haveOffers
 * @var bool $showSubscribe
 * @var array $morePhoto
 * @var bool $showSlider
 * @var string $imgTitle
 * @var string $productTitle
 * @var string $buttonSizeClass
 * @var CatalogSectionComponent $component
 */
 $arPhotoSmall = CFile::ResizeImageGet(
   $item['PREVIEW_PICTURE']['SRC'],
   array(
      'width'=>300,
      'height'=>300
   ),
   BX_RESIZE_IMAGE_EXACT
);
?>

<div class="project-grid__item" style="background-image:url('<?=$item['PREVIEW_PICTURE']['SRC']?>') ">
		<a href="<?=$item['DETAIL_PAGE_URL']?>" title="<?=$productTitle?>" class="project-grid__item_link">
      <div class="project-grid__item_header">
        <?=$productTitle?>
      </div>
    </a>
  </div>
</div>
