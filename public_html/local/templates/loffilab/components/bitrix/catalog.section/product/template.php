<?if(!defined("B_PROLOG_INCLUDED") || B_PROLOG_INCLUDED!==true)die();?>
<div class="catalog-list">
<?if($arParams["DISPLAY_TOP_PAGER"]):?>
	<?=$arResult["NAV_STRING"]?><br />
<?endif;?>

 <div class="row product-grid">
<?
foreach($arResult["ITEMS"] as $cell=>$arElement):
	$width = 0;
	$this->AddEditAction($arElement['ID'], $arElement['EDIT_LINK'], CIBlock::GetArrayByID($arParams["IBLOCK_ID"], "ELEMENT_EDIT"));
	$this->AddDeleteAction($arElement['ID'], $arElement['DELETE_LINK'], CIBlock::GetArrayByID($arParams["IBLOCK_ID"], "ELEMENT_DELETE"), array("CONFIRM" => GetMessage('CATALOG_ELEMENT_DELETE_CONFIRM')));
	$renderImage = CFile::ResizeImageGet($arElement["PREVIEW_PICTURE"], Array("width" =>'400', "height" =>'400'), BX_RESIZE_IMAGE_EXACT, true); 
	$renderImageDetail = CFile::ResizeImageGet($arElement["DETAIL_PICTURE"], Array("width" =>'400', "height" =>'400'), BX_RESIZE_IMAGE_EXACT, true); 
?>
<div class="col-md-3 col-xs-6 col-sm-4" id="<?=$this->GetEditAreaId($arElement['ID']);?>">
	 <div class="product-grid__item">
<?
	if(is_array($arElement["PREVIEW_PICTURE"])):
		$width = $arElement["PREVIEW_PICTURE"]["WIDTH"];
?>
<a href="<?=$arElement["DETAIL_PAGE_URL"]?>">

		<img border="0" src="<?=$renderImage["src"]?>"  alt="<?=$arElement["NAME"]?>" title="<?=$arElement["NAME"]?>"  class="img-responsive product-grid__item_img"/></a>

<?
	elseif(is_array($arElement["DETAIL_PICTURE"])):
		$width = $arElement["DETAIL_PICTURE"]["WIDTH"];
?>
	<div class="catalog-item-image">
		<a href="<?=$arElement["DETAIL_PAGE_URL"]?>"><img border="0" src="<?=$renderImageDetail["src"]?>?>"  alt="<?=$arElement["NAME"]?>" title="<?=$arElement["NAME"]?>" class="img-responsive product-grid__item_img" /></a>
	</div>
<?
	endif;
?>
	<div class="product-grid__item_header"><a href="<?=$arElement["DETAIL_PAGE_URL"]?>"><?=$arElement["NAME"]?></a></div>

	
 </div>
</div>
<?
endforeach; // foreach($arResult["ITEMS"] as $arElement):
?>
</div>
<?if($arParams["DISPLAY_BOTTOM_PAGER"]):?>
	<br /><?=$arResult["NAV_STRING"]?>
<?endif;?>
</div>
