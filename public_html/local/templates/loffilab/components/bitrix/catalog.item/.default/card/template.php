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

<div class="product-grid__item">
	<a class="" href="<?=$item['DETAIL_PAGE_URL']?>" title="<?=$imgTitle?>"
		data-entity="image-wrapper">
<img  id="<?=$itemIds['PICT']?>" src="<?=$item['PREVIEW_PICTURE']['SRC']?>" alt="<?=$productTitle?>" class="img-responsive product-grid__item_img">

		<?php

        if ($item['LABEL']) {
            ?>
			<div class="product-item-label-text <?=$labelPositionClass?>" id="<?=$itemIds['STICKER_ID']?>">
				<?php
                if (!empty($item['LABEL_ARRAY_VALUE'])) {
                    foreach ($item['LABEL_ARRAY_VALUE'] as $code => $value) {
                        ?>
						<div<?=(!isset($item['LABEL_PROP_MOBILE'][$code]) ? ' class="hidden-xs"' : '')?>>
							<span title="<?=$value?>"><?=$value?></span>
						</div>
						<?php
                    }
                } ?>
			</div>
			<?php
        }
        ?>

	</a>
	<div class="product-grid__item_header">
		<a href="<?=$item['DETAIL_PAGE_URL']?>" title="<?=$productTitle?>"><?=$productTitle?></a>
	</div>
	<?php



    ?>
</div>
