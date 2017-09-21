<?if (!defined("B_PROLOG_INCLUDED") || B_PROLOG_INCLUDED!==true) {
    die();
}
IncludeTemplateLangFile(__FILE__);
?>

</div>
</main>

  <section>
    <div class="section container">
      <div class="order">
        <div class="order__text">
          Закажите пошив текстильных изедилий по индвидиуальному проекту
        </div>
        <div class="order__button">
          <button type="button" class="btn btn-primary btn-lg btn-block" href="#" role="button" data-toggle="modal" data-target="#orderModal">Заказать</button>
        </div>
      </div>
    </div>
  </section>

  <div class="modal fade" id="orderModal" tabindex="-1" role="dialog" aria-labelledby="order Modal">
    <div class="modal-dialog" role="document">
      <div class="modal-content py-4 px-5">
        <div class="modal-header">
          <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
          <h4 class="modal-title">Заявка</h4>
        </div>
        <div class="modal-body">
          <form>
            <div class="form-group">
              <label for="orderName">Имя</label>
              <input type="text" class="form-control" id="orderName" placeholder="Имя">
            </div>
            <div class="form-group">
              <label for="orderEmail">E-mail</label>
              <input type="email" class="form-control" id="orderEmail" placeholder="Email">
            </div>
            <div class="form-group">
              <label for="orderPhone">Телефон</label>
              <input type="text" class="form-control" id="orderPhone" placeholder="Телефон">
            </div>
            <div class="form-group">
              <label for="orderComment">Комментарий</label>
              <textarea type="text" class="form-control" id="orderComment" placeholder="Комментарий к заявке"></textarea>
            </div>
            <div class="form-group">
              <label for="orderFiles">Прикрепите эскизы</label>
              <input type="file" id="orderFiles">
              <p class="help-block">Вы можете прикрепить несколько файлов. Общий объем не больше 100 МБ</p>
            </div>
            <div class="checkbox">
              <label>
                <input type="checkbox"> Согласен на обработку персональных данных
              </label>
            </div>
            <button type="submit" class="btn btn-primary">Отправить заявку</button>
          </form>
        </div>
      </div>
      <!-- /.modal-content -->
    </div>
    <!-- /.modal-dialog -->
  </div>
  <!-- /.modal -->

  <footer>
    <div class="footer">
      <div class="container">
        <div class="row mb-4">
        <nav >
          <div class="col-md-10 col-sm-8  col-xs-6">
            <ul class="nav nav-pills ">
              <li>
                <a class="footer-nav " href="#">Главная</a>
              </li>
              <li>
                <a class="footer-nav" href="#">Контакты</a>
              </li>
              <li>
                <a class="footer-nav" href="#">Сотрудничество</a>
              </li>
              <li>
                <a class="footer-nav" href="#">Услуги</a>
              </li>
              <li>
                <a class="footer-nav" href="#">О нас</a>
              </li>
              <li>
                <a class="footer-nav" href="#">Каталог</a>
              </li>
            </ul>
          </div>
          <div class="col-md-2 col-sm-4 mb-3 col-xs-6  ">
            <ul class="nav nav-pills ">
              <li class="pull-right">
                <a class="nav-link " href="#"><img src="<?=SITE_TEMPLATE_PATH?>/img/facebook.svg" alt="Facebook logo" width="30px"></a>
              </li>
              <li class="pull-right">
                <a class="nav-link" href="#"><img src="<?=SITE_TEMPLATE_PATH?>/img/instagram.svg" alt="instagram logo" width="30px"></a>
              </li>
            </ul>
              </div>
        </nav>
        </div>

        <address>
          <div class="row mb-3">
            <div class="col-md-8 col-xs-6">
              <div class="px-3">
                  Москва, ул. Спиридоновка, д.4, стр.1
              </div>

            </div>
            <div class="col-md-4  col-xs-6 text-right">
              <div class="mb-3">
                8 (499) 404-12-55
              </div>
              <div >
                <a href="mailto:info@loffilab.ru">info@loffilab.ru</a>
              </div>
            </div>

          </div>
        </address>
        <div class="footer-copyright">

          <small> Компания «Loffilab» Все права защищены. © 1998-2015. Нелицензированное использование материалов данного сайта запрещено</small>

        </div>
      </div>
    </div>
  </footer>

  <script src="http://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"></script>
  <!-- 33 KB -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.11.0/umd/popper.min.js" integrity="sha384-b/U6ypiBEHpOf/4+1nzFpr53nxSS+GLCkfwBdFNTxtclqqenISfwAzpKaMNFNmj4" crossorigin="anonymous"></script>
  <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js" integrity="sha384-Tc5IQib027qvyjSMfHjOMaLkfuWVxZxUPnCJA7l2mCWNIpG9mGCD8wGNIcPD7Txa" crossorigin="anonymous"></script>
  <script src="<?=SITE_TEMPLATE_PATH?>/js/main.js"></script>
  <script src="http://localhost:35729/livereload.js"></script>



</body>

</html>
